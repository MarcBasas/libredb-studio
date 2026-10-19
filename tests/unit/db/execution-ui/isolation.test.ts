/**
 * One engine's execution UI module cannot reach another engine's output. For each type id, a fresh `bun test` process
 * replaces that id's module with a sentinel spec (a commit keyword and a consent deadline no engine has) before the hook,
 * the consent card and the golden fixtures load, renders every golden key, and writes them out. Every OTHER key must
 * still equal its committed golden file, and the replaced key must not, which proves the sentinel was read. The
 * `explain =>` line is no engine's module, so it equals the golden for every key, the replaced one included.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXECUTION_UI } from "@/lib/db/execution-ui";
import { GOLDEN_KEYS } from "./fixtures";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");
const GOLDEN_DIR = join(import.meta.dir, "golden");
const FIXTURES = join(import.meta.dir, "fixtures.tsx");
const INDEX = join(ROOT, "src/lib/db/execution-ui/index.ts");
const IDS = Object.keys(EXECUTION_UI).sort();
const CONCURRENCY = 8;

/** The module path the registry index imports for `id`, read from the index itself. */
function modulePath(id: string): string {
  const name = `${id.toUpperCase()}_EXECUTION_UI`;
  const match = readFileSync(INDEX, "utf8").match(new RegExp(`import \\{ ${name} \\} from "@/([^"]+)";`));
  if (match === null) throw new Error(`the registry index imports no ${name}`);
  return join(ROOT, "src", `${match[1]}.ts`);
}

/** A test file that swaps `id`'s module for the sentinel, then renders every golden key into `out`. */
function childScript(id: string, out: string): string {
  return `import { mock, test } from "bun:test";
import { writeFileSync } from "node:fs";

mock.module(${JSON.stringify(modulePath(id))}, () => ({
  ${id.toUpperCase()}_EXECUTION_UI: {
    commitKeyword: "SENTINEL",
    consentDeadline: { chip: "SENTINEL", sentence: "SENTINEL" },
  },
}));
const { GOLDEN_KEYS, renderExecutionUiGolden } = await import(${JSON.stringify(FIXTURES)});

test("render", async () => {
  const pairs = [];
  for (const key of GOLDEN_KEYS) pairs.push([key, await renderExecutionUiGolden(key)]);
  // Object.fromEntries defines "__proto__" as an own key, where an assignment would set the prototype.
  writeFileSync(${JSON.stringify(out)}, JSON.stringify(Object.fromEntries(pairs)));
}, 120_000);
`;
}

/** The `explain =>` line of a render, which no engine module feeds. */
function explainLine(render: string): string | undefined {
  return render.split("\n").find((line) => line.startsWith("explain => "));
}

let dir = "";
const rendered = new Map<string, Record<string, string>>();
const failures = new Map<string, string>();

async function runChild(id: string): Promise<void> {
  const script = join(dir, `${id}.test.tsx`);
  const out = join(dir, `${id}.json`);
  writeFileSync(script, childScript(id, out));
  const child = Bun.spawn(["bun", "test", script], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  if (exitCode !== 0) {
    failures.set(id, stderr);
    return;
  }
  rendered.set(id, JSON.parse(readFileSync(out, "utf8")));
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "execution-ui-isolation-"));
  const queue = [...IDS];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      // oxlint-disable-next-line no-await-in-loop -- a pool of CONCURRENCY workers, each taking the next id when its child exits.
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) await runChild(id);
    }),
  );
}, 300_000);

afterAll(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
});

describe("one engine's execution UI module cannot reach another engine's output", () => {
  test("one row per shipped type id", () => {
    expect(IDS.length).toBe(42);
  });

  for (const id of IDS) {
    test(`with ${id} replaced, every other key renders its golden`, () => {
      expect(failures.get(id)).toBeUndefined();
      const output = rendered.get(id) as Record<string, string>;
      expect(Object.keys(output).sort()).toEqual([...GOLDEN_KEYS].sort());
      for (const key of GOLDEN_KEYS) {
        const golden = readFileSync(join(GOLDEN_DIR, `${key}.txt`), "utf8");
        expect({ key, explain: explainLine(output[key]) }).toEqual({ key, explain: explainLine(golden) });
        if (key === id) expect(output[key]).not.toBe(golden);
        else expect({ key, rendered: output[key] }).toEqual({ key, rendered: golden });
      }
    });
  }
});
