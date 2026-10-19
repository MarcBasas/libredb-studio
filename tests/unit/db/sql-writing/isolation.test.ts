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
 */
const GOLDEN_DIR = join(import.meta.dir, "golden");
const FIXTURES = join(import.meta.dir, "fixtures.ts");
const CONCURRENCY = 8;

const keyOf = (key: string): string | undefined => (key === "no-connection" ? undefined : key);

function scriptFor(engine: EngineModule): string {
  return `
import { mock } from "bun:test";
const SENTINEL = () => "SENTINEL";
mock.module(${JSON.stringify(engine.absPath)}, () => ({
  ${engine.exportName}: {
    escapeLiteral: SENTINEL,
    unescapeLiteral: SENTINEL,
    quoteIdentifier: SENTINEL,
    placeholder: SENTINEL,
    temporalLiteral: SENTINEL,
  },
}));
const { GOLDEN_KEYS, renderGolden } = await import(${JSON.stringify(FIXTURES)});
const keyOf = ${keyOf.toString()};
const out = {};
for (const key of GOLDEN_KEYS) out[key] = renderGolden(keyOf(key));
console.log(JSON.stringify(out));
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

describe("SQL writing isolation", () => {
  for (const engine of ENGINE_MODULES) {
    test(`${engine.id}: replacing its module moves no other engine's output`, () => {
      const run = runs.get(engine.id);
      expect({ exitCode: run?.exitCode, stderr: run?.stderr }).toEqual({ exitCode: 0, stderr: "" });
      const rendered = run?.rendered ?? {};
      expect(rendered[engine.id]).toContain('=> "SENTINEL"');
      for (const key of GOLDEN_KEYS) {
        if (key === engine.id) continue;
        expect({ key, rendered: rendered[key] }).toEqual({ key, rendered: golden(key) });
      }
    });
  }
});
