/**
 * One engine's connection string module cannot reach another engine's output. For each type id, a fresh `bun test`
 * process replaces that id's module with a sentinel spec (its own scheme, a TLS reader and a seed refusal) before the
 * parser, the seed schema and the golden fixtures load, renders every golden key, and writes them out. Every OTHER key
 * must still equal its committed golden file, and the replaced key must not, which proves the sentinel was read.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONNECTION_STRING } from "@/lib/db/connection-string";
import { GOLDEN_KEYS } from "./fixtures";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");
const GOLDEN_DIR = join(import.meta.dir, "golden");
const FIXTURES = join(import.meta.dir, "fixtures.ts");
const INDEX = join(ROOT, "src/lib/db/connection-string/index.ts");
const IDS = Object.keys(CONNECTION_STRING).sort();
const CONCURRENCY = 8;

/** The module path the registry index imports for `id`, read from the index itself. */
function modulePath(id: string): string {
  const name = `${id.toUpperCase()}_CONNECTION_STRING`;
  const match = readFileSync(INDEX, "utf8").match(new RegExp(`import \\{ ${name} \\} from "@/([^"]+)";`));
  if (match === null) throw new Error(`the registry index imports no ${name}`);
  return join(ROOT, "src", `${match[1]}.ts`);
}

/** A test file that swaps `id`'s module for the sentinel, then renders every golden key into `out`. */
function childScript(id: string, out: string): string {
  return `import { mock, test } from "bun:test";
import { writeFileSync } from "node:fs";

mock.module(${JSON.stringify(modulePath(id))}, () => ({
  ${id.toUpperCase()}_CONNECTION_STRING: {
    scheme: "sentinel",
    readTls: () => ({ sslMode: "verify-full" }),
    validateSeed: () => [{ field: "host", sentence: "SENTINEL" }],
  },
}));
const { GOLDEN_KEYS, renderConnectionStringGolden } = await import(${JSON.stringify(FIXTURES)});

test("render", () => {
  const rendered = Object.fromEntries(GOLDEN_KEYS.map((key) => [key, renderConnectionStringGolden(key)]));
  writeFileSync(${JSON.stringify(out)}, JSON.stringify(rendered));
});
`;
}

let dir = "";
const rendered = new Map<string, Record<string, string>>();
const failures = new Map<string, string>();

async function runChild(id: string): Promise<void> {
  const script = join(dir, `${id}.test.ts`);
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
  dir = mkdtempSync(join(tmpdir(), "connection-string-isolation-"));
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

describe("one engine's connection string module cannot reach another engine's output", () => {
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
        if (key === id) expect(output[key]).not.toBe(golden);
        else expect({ key, rendered: output[key] }).toEqual({ key, rendered: golden });
      }
    });
  }
});
