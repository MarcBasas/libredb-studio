/**
 * The scanner behind `tests/unit/lib/no-engine-branches.test.ts`, held to each branch shape it names and to the
 * spellings that are not a branch: a comment, a plain string argument, an untyped object key, and a longer word that
 * starts with a type id. Each case is a planted source, so a shape the scanner stops seeing fails here by name.
 */
import { describe, expect, test } from "bun:test";
import { type BranchFinding, type BranchShape, findEngineBranches } from "./scan";

const TYPE_IDS: ReadonlySet<string> = new Set(["postgres", "oracle", "mssql", "libredb"]);
const PATH = "src/planted.ts";

const scan = (source: string): BranchFinding[] => findEngineBranches(PATH, source, TYPE_IDS);
const shapes = (source: string): { declaration: string; shape: BranchShape }[] =>
  scan(source).map(({ declaration, shape }) => ({ declaration, shape }));

describe("keyed-table", () => {
  test.each([
    ["a Partial Record", "const X: Partial<Record<DatabaseType, string>> = {};"],
    ["a ReadonlySet keyed by the connection's type", 'const X: ReadonlySet<DatabaseConnection["type"]> = new Set();'],
    ["a Map", "const X: Map<DatabaseType, number> = new Map();"],
    ["a mapped type", "const X: { [K in DatabaseType]: string } = {} as never;"],
    ["a Record keyed through an alias", "type Engine = DatabaseType;\nconst X: Record<Engine, string> = {} as never;"],
    [
      "a Record keyed through an alias of an alias and a union",
      'type A = DatabaseType | DatabaseConnection["type"];\ntype B = A;\nconst X: Record<B, string> = {} as never;',
    ],
    ["a Record keyed by an Exclude", 'const X: Record<Exclude<DatabaseType, "libredb">, string> = {} as never;'],
    ["a Map built with type arguments", "const X = new Map<DatabaseType, number>();"],
    ["a Record keyed by DatabaseType or a word", 'const X: Record<DatabaseType | "default", string> = {} as never;'],
    ["a Record keyed by DatabaseType or any string", "const X: Record<DatabaseType | string, string> = {};"],
    ["a Set keyed by a type id or a word", 'const X: Set<"postgres" | "none"> = new Set();'],
  ])("%s", (_name, source) => {
    expect(shapes(source)).toEqual([{ declaration: "X", shape: "keyed-table" }]);
  });

  test("a keyed table in a type alias, an interface and a function signature names that declaration", () => {
    const source = [
      "type T = Record<DatabaseType, string>;",
      "interface I { readonly rows: ReadonlyMap<DatabaseType, string> }",
      "function f(rows: Set<DatabaseType>): void {}",
    ].join("\n");
    expect(shapes(source)).toEqual([
      { declaration: "T", shape: "keyed-table" },
      { declaration: "I", shape: "keyed-table" },
      { declaration: "f", shape: "keyed-table" },
    ]);
  });

  test("a Record keyed by a string, or a plain DatabaseType array type, is no table", () => {
    expect(scan("const X: Record<string, DatabaseType> = {};\nconst Y: DatabaseType[] = [];")).toEqual([]);
  });

  test("a Record keyed by a union of words that are not type ids is no table", () => {
    expect(scan('const X: Record<"default" | "none" | string, string> = {};')).toEqual([]);
  });
});

describe("type-id-array", () => {
  test("a typed array and a const array name their declarations", () => {
    const source = 'const L: DatabaseType[] = ["postgres"];\nconst M = ["postgres", "oracle"] as const;';
    expect(shapes(source)).toEqual([
      { declaration: "L", shape: "type-id-array" },
      { declaration: "M", shape: "type-id-array" },
    ]);
  });

  test("an array is one finding however many type ids it holds", () => {
    expect(scan('const M = new Set(["postgres", "oracle", "mssql"]);')).toHaveLength(1);
  });

  test("an array of other strings is no finding", () => {
    expect(scan('const M = ["postgresql", "mysql8"];')).toEqual([]);
  });
});

describe("comparison and case-label", () => {
  test("an equality either way round is a comparison", () => {
    const source = 'function a(type: string) { if (type === "oracle") return 1; }\nconst b = "mssql" !== dialect;';
    expect(shapes(source)).toEqual([
      { declaration: "a", shape: "comparison" },
      { declaration: "b", shape: "comparison" },
    ]);
  });

  test("a case label", () => {
    expect(shapes('function s(d: string) { switch (d) { case "postgres": return 1; } }')).toEqual([
      { declaration: "s", shape: "case-label" },
    ]);
  });

  test("a parenthesised or asserted literal still counts", () => {
    expect(shapes('const c = t === ("libredb" as DatabaseType);')).toEqual([{ declaration: "c", shape: "comparison" }]);
  });
});

describe("default-position", () => {
  test.each([
    ["an or default", 'const d = conn?.type || "postgres";', "d"],
    ["a nullish default", 'const d = x ?? "oracle";', "d"],
    ["a conditional branch", 'const d = ok ? "postgres" : y;', "d"],
    ["a parameter default", 'function f(t = "postgres") {}', "f"],
    ["a destructuring default", 'function h() { const { type: d = "mssql" } = conn; }', "h"],
    ["a nullish assignment", 'function g() { t ??= "oracle"; }', "g"],
  ])("%s", (_name, source, declaration) => {
    expect(shapes(source)).toEqual([{ declaration, shape: "default-position" }]);
  });
});

describe("not a branch", () => {
  test.each([
    ["a line comment", '// if (type === "postgres")\nconst a = 1;'],
    ["a block comment", '/* case "oracle": */\nconst a = 1;'],
    ["a plain string argument", 'log("postgres");'],
    ["an object key outside a typed table", "const o = { postgres: 1 };"],
    ["a longer word", 'const a = t === "postgresql";'],
    ["a template with a substitution", "const a = t === `${x}postgres`;"],
    ["a JSX attribute", 'const a = <Icon type="postgres" />;'],
  ])("%s", (_name, source) => {
    expect(scan(source)).toEqual([]);
  });
});

describe("the finding's place", () => {
  test("path, 1-based line, declaration and the node's text", () => {
    const source = 'const a = 1;\n\nexport class K {\n  readonly p = mode === "oracle";\n}';
    expect(scan(source)).toEqual([
      { path: PATH, declaration: "p", shape: "comparison", line: 4, text: 'mode === "oracle"' },
    ]);
  });

  test("a method names itself, and a top-level statement is the module", () => {
    const source = 'class K { m(t: string) { return t == "mssql"; } }\nif (t != "libredb") run();';
    expect(shapes(source)).toEqual([
      { declaration: "m", shape: "comparison" },
      { declaration: "<module>", shape: "comparison" },
    ]);
  });

  test("text spanning lines is folded onto one", () => {
    const source = "const X: Record<\n  DatabaseType,\n  string\n> = {} as never;";
    expect(scan(source)[0]?.text).toBe("Record< DatabaseType, string >");
  });
});
