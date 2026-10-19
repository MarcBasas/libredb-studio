import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { SQL_WRITING } from "@/lib/db/sql-writing";
import { ENGINE_MODULES, ROOT } from "./engine-modules";

/**
 * The seam between one engine's SQL writing module and every other one (spec 5.3).
 *
 * An engine module imports the contract's `types.ts` and `shared.ts` and nothing else, so
 * no module can reach another engine's rules or the registry that holds them all; a type
 * import of `@/lib/types` is allowed because it emits no code. The registry imports each
 * engine module once, and the two named specs stay the registry's own. Every module also
 * loads first in a fresh process without a `ReferenceError` (Review Focus 4), which is
 * what a typed writer or provider importing it directly would do.
 *
 * Imports are read off the TypeScript AST: static imports and exports, `import("x")` and
 * `require("x")` with a literal specifier.
 */
const ALLOWED = new Set(["@/lib/db/sql-writing/types", "@/lib/db/sql-writing/shared"]);
const TYPE_ONLY_ALLOWED = new Set(["@/lib/types"]);
const NAMED_SPECS = ["@/lib/db/sql-writing/no-connection", "@/lib/db/sql-writing/unknown-type"];

interface ImportRef {
  readonly specifier: string;
  readonly typeOnly: boolean;
}

function importsOf(file: string, text = readFileSync(file, "utf8")): ImportRef[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const refs: ImportRef[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typeOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (clause.name === undefined &&
            clause.namedBindings !== undefined &&
            ts.isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.length > 0 &&
            clause.namedBindings.elements.every((element) => element.isTypeOnly)));
      refs.push({ specifier: node.moduleSpecifier.text, typeOnly });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      refs.push({ specifier: node.moduleSpecifier.text, typeOnly: node.isTypeOnly });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      refs.push({ specifier: node.arguments[0].text, typeOnly: false });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return refs;
}

/** `src/lib/db/providers/sql/mysql-sql-writing.ts` as the alias `@/lib/db/providers/sql/mysql-sql-writing`. */
const aliasOf = (repoPath: string): string => `@/${repoPath.replace(/^src\//, "").replace(/\.ts$/, "")}`;

const forbiddenImports = (file: string, text?: string): string[] =>
  importsOf(file, text)
    .filter(({ specifier, typeOnly }) => !ALLOWED.has(specifier) && !(typeOnly && TYPE_ONLY_ALLOWED.has(specifier)))
    .map(({ specifier, typeOnly }) => (typeOnly ? `type ${specifier}` : specifier));

/** What `types.ts` or `shared.ts` imports beyond a type-only import of the contract's types; both are leaves. */
const LEAF_TYPE_ONLY_ALLOWED = new Set(["./types", "@/lib/db/sql-writing/types", "@/lib/types"]);
const LEAVES = ["types.ts", "shared.ts"].map((name) => join(ROOT, "src", "lib", "db", "sql-writing", name));

const leafViolations = (file: string, text?: string): string[] =>
  importsOf(file, text)
    .filter(({ specifier, typeOnly }) => !(typeOnly && LEAF_TYPE_ONLY_ALLOWED.has(specifier)))
    .map(({ specifier, typeOnly }) => (typeOnly ? `type ${specifier}` : specifier));

describe("SQL writing seam", () => {
  // Every engine module may import these two, so an import here reaches every engine transitively.
  for (const leaf of LEAVES) {
    test(`${leaf.slice(ROOT.length + 1)}: imports nothing but types`, () => {
      expect(leafViolations(leaf)).toEqual([]);
    });
  }

  test("a planted import in a leaf is caught", () => {
    const shared = LEAVES[1];
    expect(leafViolations(shared, `import { quoteIdentifier } from "@/lib/sql/identifier";\n`)).toEqual([
      "@/lib/sql/identifier",
    ]);
    expect(leafViolations(shared, `import type { X } from "@/lib/export/result-export";\n`)).toEqual([
      "type @/lib/export/result-export",
    ]);
    expect(leafViolations(shared, `import { SqlWritingSpec } from "./types";\n`)).toEqual(["./types"]);
    expect(leafViolations(shared, `import type { SqlWritingSpec } from "./types";\n`)).toEqual([]);
  });

  test("the modules on disk are the registry's rows", () => {
    expect(ENGINE_MODULES.map(({ id }) => id).sort()).toEqual(Object.keys(SQL_WRITING).sort());
  });

  for (const engine of ENGINE_MODULES) {
    test(`${engine.id}: imports only the contract's types and shared building blocks`, () => {
      expect({ id: engine.id, forbidden: forbiddenImports(engine.absPath) }).toEqual({ id: engine.id, forbidden: [] });
    });
  }

  test("no engine module imports a named spec", () => {
    const offenders = ENGINE_MODULES.filter((engine) =>
      importsOf(engine.absPath).some(({ specifier }) => NAMED_SPECS.includes(specifier)),
    ).map(({ id }) => id);
    expect(offenders).toEqual([]);
  });

  test("the registry imports each engine module once", () => {
    const specifiers = importsOf(join(ROOT, "src", "lib", "db", "sql-writing", "index.ts")).map(
      ({ specifier }) => specifier,
    );
    for (const engine of ENGINE_MODULES) {
      expect({ id: engine.id, count: specifiers.filter((s) => s === aliasOf(engine.repoPath)).length }).toEqual({
        id: engine.id,
        count: 1,
      });
    }
  });

  test("a planted cross-engine import is caught", () => {
    const mysql = ENGINE_MODULES.find(({ id }) => id === "mysql");
    if (mysql === undefined) throw new Error("mysql module not found");
    const planted = `import { POSTGRES_SQL_WRITING } from "@/lib/db/providers/sql/postgres-sql-writing";\n${readFileSync(mysql.absPath, "utf8")}`;
    expect(forbiddenImports(mysql.absPath, planted)).toEqual(["@/lib/db/providers/sql/postgres-sql-writing"]);
    expect(forbiddenImports(mysql.absPath, `import { SQL_WRITING } from "@/lib/db/sql-writing";\n`)).toEqual([
      "@/lib/db/sql-writing",
    ]);
    expect(forbiddenImports(mysql.absPath, `export * from "@/lib/sql/values";\n`)).toEqual(["@/lib/sql/values"]);
    expect(forbiddenImports(mysql.absPath, `const v = await import("@/lib/sql/identifier");\n`)).toEqual([
      "@/lib/sql/identifier",
    ]);
    expect(forbiddenImports(mysql.absPath, `import { type X, Y } from "@/lib/types";\n`)).toEqual(["@/lib/types"]);
    expect(forbiddenImports(mysql.absPath, `import type { DatabaseType } from "@/lib/types";\n`)).toEqual([]);
  });

  // Spec 5.4: the inline editor reads its key column kinds and bound edits from the registry,
  // so it imports nothing from either export module or any engine's own module.
  test("the inline editing hook imports no export module and no engine module", () => {
    const forbidden = importsOf(join(ROOT, "src", "hooks", "use-inline-editing.ts"))
      .map(({ specifier }) => specifier)
      .filter(
        (specifier) =>
          specifier.startsWith("@/lib/export/result-export") ||
          specifier.startsWith("@/lib/export/typed-literals") ||
          specifier.startsWith("@/lib/db/providers/"),
      );
    expect(forbidden).toEqual([]);
  });

  for (const engine of ENGINE_MODULES) {
    test(`${engine.id}: loads first in a fresh process`, () => {
      const result = Bun.spawnSync(["bun", "-e", `await import(${JSON.stringify(engine.absPath)});`], {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect({ id: engine.id, exitCode: result.exitCode, stderr: result.stderr.toString() }).toEqual({
        id: engine.id,
        exitCode: 0,
        stderr: "",
      });
    });
  }
});
