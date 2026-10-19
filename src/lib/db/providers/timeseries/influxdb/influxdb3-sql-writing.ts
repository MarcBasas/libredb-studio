import { identifierDoubleQuoted, literalStandard, unquoteStandard } from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for InfluxDB 3. */
export const INFLUXDB3_SQL_WRITING: SqlWritingSpec = {
  // Measured on InfluxDB 3.12.0: `SELECT 'it''s'` answers `it's`, and `SELECT 'a\b' AS a,
  // length('a\b') AS n` answers `a\b` and 3, so a backslash is data. DataFusion also has
  // PostgreSQL-style `E'...'` strings (measured: `SELECT E'a\nb'` decodes the escape), which
  // `quoteLiteral` never emits.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  quoteIdentifier: identifierDoubleQuoted,
  // The engine has placeholders (measured on 3.12.0: `SELECT $1 AS x` and `SELECT ? AS x` both
  // answer `Error during planning: No value found for placeholder ...`), but the route body is
  // exactly `db`, `q` and `format`, so the provider's `query()` refuses a non-empty params
  // array, and emitting a placeholder would build a statement nothing fills.
  placeholder: null,
  temporalLiteral: null,
};
