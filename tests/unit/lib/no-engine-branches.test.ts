/**
 * Outside the provider layer, no source file branches on a database type id, apart from a closed list (engine
 * contract spec 6.4).
 *
 * It reads every source file under `src/` that git lists (tracked, and untracked but not ignored), outside
 * `src/lib/db/**` and `src/lib/agent/languages/**`, and finds each branch shape `./no-engine-branches/scan.ts`
 * names: a table keyed by a type id, an array of type ids, a comparison or `case` label with one, and one in default
 * position. Every finding is held, by file and declaration name, to exactly one of three lists:
 *
 * 1. `REGISTRIES`, the mappings of spec 5.6 that stay, because their job is the mapping;
 * 2. `FALSE_POSITIVES`, a word spelled like a type id that names something else, each with what it names;
 * 3. `DEBT`, a branch that moves into an engine contract, each naming the PR that removes it.
 *
 * A listed entry that no longer matches a finding fails too, so each later PR deletes its debt entries, and the debt
 * list ends empty.
 *
 * It also carries the two other rules of the guard it replaces (#1822): `src/components/CreateTableModal.tsx` knows
 * no engine, and the removed `supportsCreateTable` flag is named nowhere under `src/`, `tests/` or `docs/`, apart
 * from this file and the history in `docs/BACKLOG.md`.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXTERNAL_DATABASE_TYPES } from "@/lib/db/compatibility";
import { type BranchFinding, findEngineBranches } from "./no-engine-branches/scan";

const ROOT = join(import.meta.dir, "..", "..", "..");
const SOURCE_FILE = /\.(c|m)?(t|j)sx?$/;
const PROVIDER_LAYER = ["src/lib/db/", "src/lib/agent/languages/"];
const THIS_FILE = "tests/unit/lib/no-engine-branches.test.ts";
const CREATE_TABLE_MODAL = "src/components/CreateTableModal.tsx";
const TYPE_IDS: ReadonlySet<string> = new Set([...EXTERNAL_DATABASE_TYPES, "libredb"]);

/** A declaration allowed to branch on a type id, by file and declaration name, with the reason it may. */
export interface Listed {
  readonly path: string;
  readonly declaration: string;
  readonly reason: string;
}

/** A branch that moves into an engine contract, with the PR of the engine contract plan that removes it. */
export interface Debt extends Listed {
  readonly pr: 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

/** What each later PR of the engine contract plan moves. */
const MOVES_IN: Readonly<Record<Debt["pr"], string>> = {
  2: "SQL writing, values: the literal, identifier and placeholder rules",
  3: "SQL writing, inline editing: the editor's per-engine value rules (docs/BACKLOG.md R4)",
  4: "SQL writing, export: the per-engine export tables",
  5: "the SQL grammar: tokenizer, update target, redaction and completion quoting",
  6: "migration DDL (docs/BACKLOG.md D376)",
  7: "the connection form, connection string and seed checks",
  8: "execution UI and the explain request default",
};

const DISPLAY_ORDER = "display order only";
const INBOUND = "an inbound mapping from an outside name to a type id";
const AGENT_LEG = "the agent-leg pattern, guarded by its own tests";
const STORAGE_BACKEND = "the storage backend `STORAGE_PROVIDER` names, not an engine";
const AWS_CLI_SERVICE = "the AWS CLI service name `s3` in a typed command, not the engine";

/** The registries of spec 5.6, which stay. */
export const REGISTRIES: readonly Listed[] = [
  { path: "src/components/admin/tabs/OverviewTab.tsx", declaration: "DB_TYPES_PREVIEW", reason: DISPLAY_ORDER },
  { path: "src/hooks/use-connection-form.ts", declaration: "selectableTypes", reason: DISPLAY_ORDER },
  { path: "src/lib/db-showcase.ts", declaration: "SHOWCASE_RANK", reason: DISPLAY_ORDER },
  {
    path: "src/lib/db-ui-config.ts",
    declaration: "DB_UI_CONFIG",
    reason: "the total data registry, and the connection form's contract home",
  },
  {
    path: "src/lib/seed/types.ts",
    declaration: "SeedDatabaseType",
    reason: "the seed file's validation mirror of the type-id union",
  },
  { path: "src/lib/seed/discovery-fingerprint.ts", declaration: "IMAGE_ENGINES", reason: INBOUND },
  {
    path: "src/lib/seed/discovery-fingerprint.ts",
    declaration: "credentialsOf",
    reason: "an inbound mapping of a container image's env names, owned by the discovery spec",
  },
  {
    path: "src/lib/sql/fence-tags.ts",
    declaration: "ENGINE_FENCE_TAGS",
    reason: "the total name registry of code fence tags",
  },
  { path: "src/lib/agent/agent-manifest.ts", declaration: "AGENT_STATEMENT_LANGUAGE", reason: AGENT_LEG },
  { path: "src/lib/agent/agent-manifest.ts", declaration: "AGENT_REQUIREMENT_ENGINES", reason: AGENT_LEG },
  {
    path: "src/lib/agent/agent-manifest.ts",
    declaration: "AgentAvailabilityTables",
    reason: "the type of the agent-leg tables above, which availability is decided from",
  },
  { path: "src/lib/agent/engine-support.ts", declaration: "AGENT_EXECUTION_ENGINES", reason: AGENT_LEG },
  {
    path: "src/lib/governance/config.ts",
    declaration: "ALLOWED_ENGINES_DEFAULT",
    reason: "a policy default, not engine behaviour",
  },
];

/** A spelling of a type id that names something else. */
export const FALSE_POSITIVES: readonly Listed[] = [
  { path: "src/lib/storage/provider-type.ts", declaration: "getStorageProviderType", reason: STORAGE_BACKEND },
  { path: "src/lib/storage/factory.ts", declaration: "getStorageProvider", reason: STORAGE_BACKEND },
  {
    path: "src/lib/agent/config.ts",
    declaration: "resolveAgentAvailability",
    reason: "the agent ledger's storage backend, not an engine",
  },
  { path: "src/lib/config/auth-preflight.ts", declaration: "verifyStorageSchemaAtBoot", reason: STORAGE_BACKEND },
  {
    path: "src/lib/governance/config.ts",
    declaration: "governanceSource",
    reason: "the governance source setting, which names where policy is stored",
  },
  { path: "src/lib/editor/s3-completions.ts", declaration: "operationOf", reason: AWS_CLI_SERVICE },
  { path: "src/lib/editor/s3-completions.ts", declaration: "s3CompletionContext", reason: AWS_CLI_SERVICE },
  { path: "src/lib/editor/s3-completions.ts", declaration: "itemsOf", reason: AWS_CLI_SERVICE },
  {
    path: "src/lib/editor/firestore-language.ts",
    declaration: "FIRESTORE_MONARCH",
    reason: "the `firestore` namespace of the Firestore SDK, highlighted as a type name",
  },
  {
    path: "src/lib/distribution/channels.generated.ts",
    declaration: "LIVE_PLATFORMS",
    reason: "the `kubernetes` install platform of the channel showcase",
  },
  {
    path: "src/lib/distribution/deploy-groups.ts",
    declaration: "DEPLOY_GROUP_ORDER",
    reason: "the `kubernetes` channel group of the channel showcase",
  },
  {
    path: "src/lib/seed/discovery-fingerprint.ts",
    declaration: "user",
    reason: "the PostgreSQL image's default role name `postgres`, when POSTGRES_USER is unset",
  },
  {
    path: "src/components/agent/AnswerCard.tsx",
    declaration: "LANGUAGE_ACCENTS",
    reason: "keyed by the agent statement language, some of whose names are spelled like type ids",
  },
  {
    path: "src/lib/seed/types.ts",
    declaration: "refuseMcpWhereNotOffered",
    reason: "the parameter type of the `MCP_EXPOSABLE` registry it is handed, which holds no row here",
  },
];

/** Every branch of spec 2.6 not yet moved, with the PR that moves it. */
export const DEBT: readonly Debt[] = [
  { path: "src/lib/sql/values.ts", declaration: "LITERAL_ESCAPE", pr: 2, reason: MOVES_IN[2] },
  { path: "src/lib/sql/values.ts", declaration: "temporalLiteral", pr: 2, reason: MOVES_IN[2] },
  { path: "src/lib/sql/values.ts", declaration: "positionalPlaceholder", pr: 2, reason: MOVES_IN[2] },
  { path: "src/lib/sql/identifier.ts", declaration: "quoteIdentifier", pr: 2, reason: MOVES_IN[2] },
  { path: "src/hooks/use-inline-editing.ts", declaration: "NO_INSTANT_TYPE_DIALECTS", pr: 3, reason: MOVES_IN[3] },
  { path: "src/hooks/use-inline-editing.ts", declaration: "FLOAT64_ONLY_DIALECTS", pr: 3, reason: MOVES_IN[3] },
  { path: "src/hooks/use-inline-editing.ts", declaration: "NO_EXACT_DECIMAL_DIALECTS", pr: 3, reason: MOVES_IN[3] },
  { path: "src/hooks/use-inline-editing.ts", declaration: "boundEditText", pr: 3, reason: MOVES_IN[3] },
  { path: "src/hooks/use-inline-editing.ts", declaration: "boundEditValue", pr: 3, reason: MOVES_IN[3] },
  { path: "src/lib/export/result-export.ts", declaration: "DIALECT_TYPES", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "STANDS_ALONE", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "DIALECT_BARE_SPELLING", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "DECLARED_TYPE_REWRITE", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "sqlTypeOf", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "BINARY_LITERAL", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "NON_FINITE_LITERALS", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "INSERT_SELECT_DIALECTS", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "oracleColumns", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/result-export.ts", declaration: "buildResultExport", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/export/typed-literals.ts", declaration: "TYPED_WRITERS", pr: 4, reason: MOVES_IN[4] },
  { path: "src/lib/sql/grammar.ts", declaration: "SQL_GRAMMARS", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/sql/grammar.ts", declaration: "NON_SQL_DIALECTS", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/sql/update-target.ts", declaration: "readPieces", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/sql/update-target.ts", declaration: "opens", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/sql/update-target.ts", declaration: "setOp", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/query-events/redact.ts", declaration: "NAME_QUOTES", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/query-events/redact.ts", declaration: "COMMAND_READERS", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/editor/sql-completions.ts", declaration: "formatSegment", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/editor/sql-completions.ts", declaration: "tableSuggestions", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/editor/sql-completions.ts", declaration: "quotedIdentifier", pr: 5, reason: MOVES_IN[5] },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "defaultClause", pr: 6, reason: MOVES_IN[6] },
  {
    path: "src/lib/schema-diff/migration-generator.ts",
    declaration: "NO_COLUMN_MODIFICATION",
    pr: 6,
    reason: MOVES_IN[6],
  },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "NO_DROP_IF_EXISTS", pr: 6, reason: MOVES_IN[6] },
  {
    path: "src/lib/schema-diff/migration-generator.ts",
    declaration: "NO_TRANSACTION_WRAPPER",
    pr: 6,
    reason: MOVES_IN[6],
  },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "NO_TABLE_DDL", pr: 6, reason: MOVES_IN[6] },
  {
    path: "src/lib/schema-diff/migration-generator.ts",
    declaration: "NO_PORTABLE_INDEX_DDL",
    pr: 6,
    reason: MOVES_IN[6],
  },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "NO_FOREIGN_KEYS", pr: 6, reason: MOVES_IN[6] },
  {
    path: "src/lib/schema-diff/migration-generator.ts",
    declaration: "NO_PRIMARY_KEY_CONSTRAINT",
    pr: 6,
    reason: MOVES_IN[6],
  },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "type", pr: 6, reason: MOVES_IN[6] },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "generateColumnDef", pr: 6, reason: MOVES_IN[6] },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "modifiers", pr: 6, reason: MOVES_IN[6] },
  {
    path: "src/lib/schema-diff/migration-generator.ts",
    declaration: "FOREIGN_KEY_ONLY_IN_CREATE_TABLE",
    pr: 6,
    reason: MOVES_IN[6],
  },
  {
    path: "src/lib/schema-diff/migration-generator.ts",
    declaration: "generateCreateTable",
    pr: 6,
    reason: MOVES_IN[6],
  },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "conditional", pr: 6, reason: MOVES_IN[6] },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "generateAlterTable", pr: 6, reason: MOVES_IN[6] },
  { path: "src/lib/schema-diff/migration-generator.ts", declaration: "keyword", pr: 6, reason: MOVES_IN[6] },
  {
    path: "src/lib/schema-diff/migration-generator.ts",
    declaration: "generateMigrationSQL",
    pr: 6,
    reason: MOVES_IN[6],
  },
  { path: "src/components/SchemaDiff.tsx", declaration: "dialect", pr: 6, reason: MOVES_IN[6] },
  { path: "src/components/ConnectionModal.tsx", declaration: "isCouchbase", pr: 7, reason: MOVES_IN[7] },
  { path: "src/components/ConnectionModal.tsx", declaration: "isTrino", pr: 7, reason: MOVES_IN[7] },
  { path: "src/components/ConnectionModal.tsx", declaration: "isCassandra", pr: 7, reason: MOVES_IN[7] },
  { path: "src/components/ConnectionModal.tsx", declaration: "isMongoDB", pr: 7, reason: MOVES_IN[7] },
  { path: "src/components/ConnectionModal.tsx", declaration: "isLibSQL", pr: 7, reason: MOVES_IN[7] },
  { path: "src/components/ConnectionModal.tsx", declaration: "formContent", pr: 7, reason: MOVES_IN[7] },
  { path: "src/hooks/use-connection-form.ts", declaration: "buildConnection", pr: 7, reason: MOVES_IN[7] },
  { path: "src/lib/connection-string-parser.ts", declaration: "ENGINE_URI_SCHEMES", pr: 7, reason: MOVES_IN[7] },
  { path: "src/lib/connection-string-parser.ts", declaration: "readQueryTLS", pr: 7, reason: MOVES_IN[7] },
  { path: "src/lib/seed/types.ts", declaration: "SEED_LOAD_CHECKS", pr: 7, reason: MOVES_IN[7] },
  { path: "src/lib/seed/types.ts", declaration: "SeedConnectionSchema", pr: 7, reason: MOVES_IN[7] },
  {
    path: "src/lib/seed/connection-filter.ts",
    declaration: "assertApiKeyPairIsElasticsearch",
    pr: 7,
    reason: MOVES_IN[7],
  },
  { path: "src/hooks/use-query-execution.ts", declaration: "keepKeyword", pr: 8, reason: MOVES_IN[8] },
  { path: "src/components/agent/ConsentCard.tsx", declaration: "isSqlite", pr: 8, reason: MOVES_IN[8] },
  { path: "src/components/VisualExplain.tsx", declaration: "response", pr: 8, reason: MOVES_IN[8] },
];

/** Every file git lists under `paths`: tracked, or untracked and not ignored. */
function listedFiles(...paths: string[]): string[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...paths], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return [...new Set(listed.split("\0"))].filter((path) => path !== "" && existsSync(join(ROOT, path))).sort();
}

/** Every branch on a type id in the source files outside the provider layer. */
function branches(): BranchFinding[] {
  return listedFiles("src")
    .filter((path) => SOURCE_FILE.test(path) && !PROVIDER_LAYER.some((layer) => path.startsWith(layer)))
    .flatMap((path) => findEngineBranches(path, readFileSync(join(ROOT, path), "utf8"), TYPE_IDS));
}

const LISTS: Readonly<Record<string, readonly Listed[]>> = { REGISTRIES, FALSE_POSITIVES, DEBT };
const key = ({ path, declaration }: { path: string; declaration: string }): string => `${path} ${declaration}`;

describe("type-id branches outside the provider layer", () => {
  const found = branches();

  test("are each held by exactly one list", () => {
    const unheld = found
      .filter(
        (finding) => Object.values(LISTS).filter((list) => list.some((e) => key(e) === key(finding))).length !== 1,
      )
      .map((finding) => `${finding.path}:${finding.line} ${finding.declaration} ${finding.shape} ${finding.text}`);
    expect(unheld).toEqual([]);
  });

  test("leave no listed entry without a branch", () => {
    const present = new Set(found.map(key));
    const absent = Object.entries(LISTS).flatMap(([name, list]) =>
      list.filter((entry) => !present.has(key(entry))).map((entry) => `${name}: ${key(entry)} (${entry.reason})`),
    );
    expect(absent).toEqual([]);
  });

  test("list each entry once, and each debt entry names a PR of the plan", () => {
    const keys = Object.values(LISTS).flatMap((list) => list.map(key));
    expect(keys.filter((entry, at) => keys.indexOf(entry) !== at)).toEqual([]);
    expect(DEBT.filter((entry) => !(entry.pr >= 2 && entry.pr <= 8)).map(key)).toEqual([]);
  });
});

describe("the Create Table form knows no engine (#1822)", () => {
  const source = readFileSync(join(ROOT, CREATE_TABLE_MODAL), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  test("imports no DatabaseType and takes no dbType", () => {
    expect(source.match(/\b(DatabaseType|dbType)\b/g) ?? []).toEqual([]);
  });

  test("spells no type id as a string literal", () => {
    const spelled = [...TYPE_IDS].filter((id) =>
      ['"', "'", "`"].some((quote) => source.includes(`${quote}${id}${quote}`)),
    );
    expect(spelled).toEqual([]);
  });
});

describe("the removed supportsCreateTable flag (#1822)", () => {
  test("is named nowhere under src, tests or docs", () => {
    const exempt = new Set([THIS_FILE, "docs/BACKLOG.md"]);
    const named = listedFiles("src", "tests", "docs")
      .filter((path) => !exempt.has(path))
      .filter((path) => readFileSync(join(ROOT, path), "utf8").includes("supportsCreateTable"));
    expect(named, "declare `createTable` in the provider's capabilities").toEqual([]);
  });
});
