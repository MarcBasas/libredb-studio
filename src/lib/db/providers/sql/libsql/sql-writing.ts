import {
  BARE_TYPE_FAMILY,
  CLICKHOUSE_WRAPPER,
  EXACT_NUMERIC_TYPE,
  FLOAT_TYPE,
  identifierDoubleQuoted,
  literalStandard,
  NO_BARE_SPELLING,
  NULL_NON_FINITE,
  STANDARD_DDL_TYPES,
  unquoteStandard,
} from "@/lib/db/sql-writing/shared";
import { binaryStandardHex } from "@/lib/db/sql-writing/export-shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for libSQL. */
export const LIBSQL_SQL_WRITING: SqlWritingSpec = {
  // Measured on sqld 0.24.33: `SELECT 'it''s'` answers `it's`, and a backslash has no
  // special meaning - the same standard doubling SQLite defines.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  quoteIdentifier: identifierDoubleQuoted,
  placeholder: null,
  temporalLiteral: null,
  inlineEdit: {
    /**
     * libSQL has NO instant type at all, so the words that name one everywhere else state
     * nothing here.
     *
     * libSQL embeds SQLite, and SQLITE HAS NO DATE TYPE. A column declared `DATE`, `DATETIME`
     * or `TIMESTAMP` picks no storage class from its declaration: it holds the TEXT somebody put
     * in it, or the integer, and `sqlite3_column_decltype` reports the declaration back
     * verbatim beside it. So the value the driver hands over IS the value the row holds, it is
     * its own identity, and it matches when it is sent back — which is the opposite of what the
     * word means everywhere else, where the driver hands over a `Date` or a rendering of one.
     *
     * MEASURED 2026-09-19 on bun:sqlite (Bun 1.4.0) and on libSQL server v0.24.33 over its HTTP
     * pipeline, `zz_<decl>(k <decl> PRIMARY KEY, note TEXT)` for each of `DATE`, `DATETIME` and
     * `TIMESTAMP` against `'2024-01-15'`, `'2026-01-01 10:00:00.123'`, the ISO text
     * `'2026-01-01T07:00:00.123Z'` and the integer epoch 1705276800 — three declarations by
     * four value shapes by two engines, 24 combinations. Every one reported the declaration
     * back verbatim, answered `text` (or `integer`, for the epoch) to `typeof()`, handed the
     * value back unchanged, matched ONE group holding ONE row for `WHERE k IN (?)`, and changed
     * exactly one row on the `UPDATE` that followed.
     *
     * libSQL states this for the reason it states `float64TypeNames: "all"`: it embeds the same
     * engine and reports the same declarations — measured over the wire rather than reasoned
     * from that, and identical to bun:sqlite on all twelve of its combinations.
     *
     * NO OTHER DIALECT but SQLite states this, and the closed side is the safe side here as
     * everywhere else in the inline edit. MEASURED the same day: PostgreSQL 16.15
     * `zz_m1_ts(ts_id timestamp PRIMARY KEY)` holding 10:00:00.123456 and .654321 answered ZERO
     * rows for the `'2026-01-01T07:00:00.123Z'` the browser holds and zero for
     * `'2026-01-01 10:00:00.123'`, with both rows still in the table; MySQL 8.4.11
     * `zz_m1_dt(d_id DATETIME(6) PRIMARY KEY)` answered zero for both of the same two. Those
     * engines really do store something the value in front of us is only a rendering of, so
     * they keep the refusal.
     *
     * A `Date` is refused on every dialect including this one, because `String(date)` is a
     * rendering whatever holds it: the driver never produces one, so it can only have come
     * from the host application the embeddable shell runs inside.
     */
    instantTypeNames: new Set<string>(),
    /**
     * The words that are an exact decimal elsewhere are an AFFINITY here, not an exact
     * decimal type at all.
     *
     * SQLite HAS NO DECIMAL TYPE, the way it has no date type (`instantTypeNames` above) and
     * no 32-bit float (`float64TypeNames` below). A column declared `DECIMAL(20,4)` or
     * `NUMERIC(20,4)` takes NUMERIC affinity and stores an integer or an 8-byte double — so
     * what the driver hands over IS the value the row holds, and "the driver rounded it to fit"
     * would be false about it.
     *
     * libSQL states this for the reason it states the other two: it embeds the same engine and
     * reports the same `sqlite3_column_decltype` declarations. The measurement is the SQLite
     * module's, on bun:sqlite.
     */
    exactDecimalTypeNames: new Set<string>(),
    /**
     * libSQL has only ONE float width, so every declaration states it.
     *
     * SQLite, which libSQL embeds, has no 32-bit float: `REAL`, `FLOAT`, `DOUBLE` and
     * `DOUBLE PRECISION` are four spellings of one storage class, 8 bytes of IEEE double, which
     * is exactly as wide as the JavaScript number in front of us. So on this dialect the
     * declaration DOES say the width, and the refusal's sentence — "nothing here says the
     * column holds it as a 64-bit float" — is false about it.
     *
     * MEASURED 2026-09-18 through the real provider path, on bun:sqlite (Bun 1.4.0) and on
     * libSQL server v0.24.33 over its HTTP pipeline: `zz_real(r REAL, f FLOAT, d DOUBLE, dp
     * DOUBLE PRECISION)` reported those four decltypes and answered `real` to `typeof()` for
     * every one of them; 0.30000000000000004 was written and read back identical, which no
     * 32-bit column can do; and `WHERE r = 1.5`, `WHERE f = 0.1`, `WHERE d =
     * 0.30000000000000004` and `WHERE dp = 0.1` each matched exactly one row on both.
     *
     * libSQL states this for the reason SQLite does: it embeds the same engine and reports the
     * same `sqlite3_column_decltype` declarations.
     *
     * NO OTHER DIALECT but SQLite states this, and each was measured rather than assumed.
     * PostgreSQL 16.15: `real` and `float4` are both spelled `real` by `pg`, both
     * `pg_column_size` 4, and `0.1::real::float8` is 0.10000000149011612 — a different number
     * to the double 0.1. MySQL 8.4.11: one row holding 0.1 in a `FLOAT` and a `DOUBLE` answered
     * `f = 0.1` FALSE and `d = 0.1` TRUE. DuckDB: `REAL` and `FLOAT` are one 32-bit type, handed
     * over as 0.10000000149011612, and `r::DOUBLE = 0.1` is false. Trino was not reachable to
     * measure, so it keeps the refusal — the closed side is the safe side, which is what this
     * rule already chose.
     *
     * And "all" rather than the words `real` and `float`: whatever a column is called, a
     * fractional value in it is the 8-byte double the file holds, so it is its own identity and
     * the length rule - which exists to catch the printed form of a 32-bit float - has nothing
     * to catch. Reading only those two words refused the rest, a `DATE` column holding a julian
     * day among them, measured on bun:sqlite in the SQLite module.
     */
    float64TypeNames: "all",
  },
  export: {
    ddlTypes: STANDARD_DDL_TYPES,
    // The same list, for the same measured reason: libSQL IS SQLite 3.47.0, and
    // `pragma_table_info` there answers the declared spelling verbatim too (measured on
    // sqld 0.24.33). Written out rather than aliased so a future divergence can be
    // recorded in one row without touching the other.
    standsAlone: [
      "character varying",
      "varchar",
      "varchar2",
      "nvarchar",
      "nvarchar2",
      "character",
      "char",
      "nchar",
      "text",
      "ntext",
      "tinytext",
      "mediumtext",
      "longtext",
      "clob",
      "nclob",
      "binary",
      "varbinary",
      "raw",
      "blob",
      "tinyblob",
      "mediumblob",
      "longblob",
      "bytea",
      "image",
      "numeric",
      "decimal",
      "number",
      "binary_double",
      "binary_float",
      "money",
      "timestamp",
      "timestamp without time zone",
      "timestamp with time zone",
      "datetime",
      "datetime2",
      "smalldatetime",
      "datetimeoffset",
      "year",
    ],
    bareSpelling: NO_BARE_SPELLING,
    typeVocabulary: {
      bareTypeFamily: BARE_TYPE_FAMILY,
      floatType: FLOAT_TYPE,
      exactNumericType: EXACT_NUMERIC_TYPE,
      numericWrapper: CLICKHOUSE_WRAPPER,
    },
    // Measured over Hrana on sqld 0.24.33: `SELECT hex(X'0102deadbeef')` answers
    // `0102DEADBEEF`, `typeof(X'')` answers `blob` and `length(X'')` answers 0 - the
    // same readings as the SQLite row above, taken again rather than assumed.
    binaryLiteral: binaryStandardHex,
    nonFinite: NULL_NON_FINITE,
    insertForm: "values",
  },
};
