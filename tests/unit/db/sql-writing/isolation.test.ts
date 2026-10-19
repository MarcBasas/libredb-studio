import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type EngineModule, ENGINE_MODULES, ROOT } from "./engine-modules";
import { GOLDEN_KEYS, goldenFileName } from "./fixtures";

/**
 * One engine's SQL writing module cannot reach another engine's output.
 *
 * For each engine a fresh `bun` process replaces that engine's module with a sentinel spec
 * whose every function answers `"SENTINEL"`, then renders every golden key through the
 * public functions. Every OTHER key must still match its committed golden file, and the
 * replaced engine's own output must show the sentinel, so a mock that never took hold
 * cannot pass as isolation. Each engine runs in its own process because bun's module
 * mocks are process-wide with no undo.
 *
 * The inline edit field gets a sentinel of its own, `BOUND_EDIT`, because every other
 * sentinel already lands in an edit's SQL through the quoted names and the placeholders.
 * Where the committed golden file shows an edit reaching its UPDATE, every edit of a value
 * that is not NULL must carry `BOUND_EDIT`, so the hook read the mocked `inlineEdit`.
 *
 * The export field answers `SENTINEL` for every spelling it writes. The replaced engine's
 * `ddl(inferred)` line must show a quoted name followed by a sentinel type, so the export
 * read the mocked `export` and not a table of its own.
 *
 * Its type vocabulary is a sentinel too, one that disagrees with the shared vocabulary on
 * every declared type the fixtures use: no bare name has a family, no wrapper unwraps, no
 * exact numeric type matches, and only a bare `Float64` is a float. So `varchar2` stays
 * declared as it is, and the CSV formula guard quotes every `-Infinity` cell, where the
 * shared vocabulary would re-spell the one and leave five of the others bare. Either line
 * moving back to the golden means the export read a vocabulary other than the engine's.
 */
const GOLDEN_DIR = join(import.meta.dir, "golden");
const FIXTURES = join(import.meta.dir, "fixtures.ts");
const CONCURRENCY = 8;
const BOUND_EDIT = "INLINE_EDIT_SENTINEL";

const keyOf = (key: string): string | undefined =>
  key === "no-connection" ? undefined : key === "empty-string" ? "" : key;

function scriptFor(engine: EngineModule): string {
  return `
import { mock } from "bun:test";
const SENTINEL = () => "SENTINEL";
const actual = await import(${JSON.stringify(engine.absPath)});
mock.module(${JSON.stringify(engine.absPath)}, () => ({
  ...actual,
  ${engine.exportName}: {
    escapeLiteral: SENTINEL,
    unescapeLiteral: SENTINEL,
    quoteIdentifier: SENTINEL,
    placeholder: SENTINEL,
    temporalLiteral: SENTINEL,
    inlineEdit: {
      instantTypeNames: new Set(),
      exactDecimalTypeNames: new Set(),
      float64TypeNames: "all",
      boundEdit: () => ${JSON.stringify(BOUND_EDIT)},
    },
    export: {
      ddlTypes: { text: "SENTINEL", integer: "SENTINEL", numeric: "SENTINEL", boolean: "SENTINEL", timestamp: "SENTINEL", binary: "SENTINEL" },
      standsAlone: [],
      bareSpelling: {},
      typeVocabulary: {
        bareTypeFamily: {},
        floatType: /^Float64$/,
        exactNumericType: /^SENTINEL_EXACT$/,
        numericWrapper: /^SENTINEL_WRAPPER\((.*)\)$/,
      },
      binaryLiteral: SENTINEL,
      nonFinite: { NaN: "SENTINEL", Infinity: "SENTINEL", "-Infinity": "SENTINEL" },
      insertForm: "values",
      typedLiteral: SENTINEL,
    },
  },
}));
const { GOLDEN_KEYS, renderGolden } = await import(${JSON.stringify(FIXTURES)});
const keyOf = ${keyOf.toString()};
const out = {};
for (const key of GOLDEN_KEYS) out[key] = await renderGolden(keyOf(key));
// Awaited: console.log of this much output into the pipe is cut at 64 KiB when the process exits.
await Bun.write(Bun.stdout, JSON.stringify(out));
`;
}

interface Run {
  readonly exitCode: number;
  readonly stderr: string;
  readonly rendered: Record<string, string>;
}

async function render(engine: EngineModule): Promise<Run> {
  const child = Bun.spawn(["bun", "-e", scriptFor(engine)], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stderr, rendered: exitCode === 0 ? (JSON.parse(stdout) as Record<string, string>) : {} };
}

const runs = new Map<string, Run>();

beforeAll(async () => {
  const queue = [...ENGINE_MODULES];
  const worker = async (): Promise<void> => {
    for (let engine = queue.shift(); engine !== undefined; engine = queue.shift()) {
      runs.set(engine.id, await render(engine));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}, 120_000);

const golden = (key: string): string => readFileSync(join(GOLDEN_DIR, goldenFileName(key)), "utf8");

/** The `edit(` lines of a rendering whose edited text is a value, not NULL. */
const valueEdits = (rendered: string): string[] =>
  rendered.split("\n").filter((line) => line.startsWith("edit(") && !/^edit\([^,]+, "(NULL)?", /.test(line));

/** The engine's committed edits reach their UPDATE: the key check ran, so a bound edit has a statement to land in. */
const editsReachUpdate = (key: string): boolean =>
  valueEdits(golden(key)).every((line) => !line.includes('"keyCheck":null'));

describe("SQL writing isolation", () => {
  for (const engine of ENGINE_MODULES) {
    test(`${engine.id}: replacing its module moves no other engine's output`, () => {
      const run = runs.get(engine.id);
      expect({ exitCode: run?.exitCode, stderr: run?.stderr }).toEqual({ exitCode: 0, stderr: "" });
      const rendered = run?.rendered ?? {};
      expect(rendered[engine.id]).toContain('=> "SENTINEL"');
      const ddl = (rendered[engine.id] ?? "").split("\n").find((line) => line.startsWith("ddl(inferred) => "));
      expect(ddl).toContain("SENTINEL SENTINEL");
      const lineOf = (prefix: string): string | undefined =>
        (rendered[engine.id] ?? "").split("\n").find((line) => line.startsWith(prefix));
      expect(lineOf('ddl("varchar2") => ')).toBe('ddl("varchar2") => "CREATE TABLE t (\\n  SENTINEL varchar2\\n);"');
      expect(lineOf("csv(numeric) => ")).toBe(
        `csv(numeric) => "nf,lc,df,nm,bd,tx,none\\n${Array(7).fill(`\\"'-Infinity\\"`).join(",")}\\n${Array(7).fill(`\\"'=1+1\\"`).join(",")}"`,
      );
      if (editsReachUpdate(engine.id)) {
        const edits = valueEdits(rendered[engine.id] ?? "");
        expect(edits.length).toBeGreaterThan(0);
        expect(edits.filter((line) => !line.includes(BOUND_EDIT))).toEqual([]);
      }
      for (const key of GOLDEN_KEYS) {
        if (key === engine.id) continue;
        expect({ key, rendered: rendered[key] }).toEqual({ key, rendered: golden(key) });
      }
    });
  }
});
