import { identifierDoubleQuoted, literalStandard, unquoteStandard } from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Trino. */
export const TRINO_SQL_WRITING: SqlWritingSpec = {
  // Measured on Trino 476 (2026-08-20), both directions: `SELECT 'O''Brien' AS a`
  // answers `O'Brien`, so doubling is the escape; `SELECT 'a\\b' AS a` answers the two
  // characters `a\\b`, so a backslash is DATA and doubling it would add a second one to
  // the value. Trino spells its backslash escapes in the separate `U&'fo\\+0000F6'`
  // form, exactly as Druid does.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form. Measured on 476: `SELECT "nationkey" FROM
  // tpch.sf1.nation LIMIT 1` returns the column, `SELECT 1 AS "a""b"` names it
  // `a"b`, and a backtick is refused in the engine's own words - "backquoted
  // identifiers are not supported; use double quotes to quote identifiers".
  quoteIdentifier: identifierDoubleQuoted,
  // Trino really does bind, through `PREPARE`/`EXECUTE` plus an `X-Trino-Prepared-Statement`
  // header, but the provider's transport seam carries the statement alone, so
  // `TrinoProvider.query()` REFUSES a non-empty params array outright. Emitting `?` here
  // would build a statement whose placeholder the provider then declines to fill.
  placeholder: null,
  temporalLiteral: null,
};
