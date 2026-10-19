/**
 * One engine's connection fields cannot reach another engine's form. For each type id, a fresh `bun test` process
 * loads the real `src/lib/db/connection-fields.ts`, replaces it with a copy whose row for that id is `["host"]` (every
 * other export and row the real object), then loads the dialog through the golden fixtures and renders every engine's
 * form. Every OTHER engine must still equal its committed golden file, and the replaced engine must not, which proves
 * the copy was read. `SEED_ONLY_FIELDS` stays real: a seed-only row is read for every other engine by design.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FORM_KEYS } from "./fixtures";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");
const GOLDEN_DIR = join(import.meta.dir, "golden");
const FIXTURES = join(import.meta.dir, "fixtures.tsx");
const CONNECTION_FIELDS_MODULE = join(ROOT, "src/lib/db/connection-fields.ts");
const CONCURRENCY = 8;

/** A test file that swaps `id`'s connection fields for `["host"]`, then renders every engine's form into `out`. */
function childScript(id: string, out: string): string {
  return `import { mock, test } from "bun:test";
import { writeFileSync } from "node:fs";

const real = await import(${JSON.stringify(CONNECTION_FIELDS_MODULE)});
const copy = {
  ...real,
  CONNECTION_FIELDS: Object.freeze({ ...real.CONNECTION_FIELDS, ${JSON.stringify(id)}: Object.freeze(["host"]) }),
};
mock.module(${JSON.stringify(CONNECTION_FIELDS_MODULE)}, () => copy);
const { FORM_KEYS, renderFormGolden } = await import(${JSON.stringify(FIXTURES)});

test("render", async () => {
  const rendered = {};
  for (const key of FORM_KEYS) rendered[key] = await renderFormGolden(key);
  writeFileSync(${JSON.stringify(out)}, JSON.stringify(rendered));
}, 120_000);
`;
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
  dir = mkdtempSync(join(tmpdir(), "connection-form-isolation-"));
  const queue = [...FORM_KEYS];
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

describe("one engine's connection fields cannot reach another engine's form", () => {
  test("one form per shipped type id", () => {
    expect(FORM_KEYS.length).toBe(42);
  });

  for (const id of FORM_KEYS) {
    test(`with ${id}'s fields replaced, every other engine renders its golden`, () => {
      expect(failures.get(id)).toBeUndefined();
      const output = rendered.get(id) as Record<string, string>;
      expect(Object.keys(output).sort()).toEqual([...FORM_KEYS].sort());
      for (const key of FORM_KEYS) {
        const golden = readFileSync(join(GOLDEN_DIR, `${key}.txt`), "utf8");
        if (key === id) expect(output[key]).not.toBe(golden);
        else expect({ key, rendered: output[key] }).toEqual({ key, rendered: golden });
      }
    });
  }
});
