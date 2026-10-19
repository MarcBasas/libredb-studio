import { identifierDoubleQuoted, literalStandard, unquoteStandard } from "@/lib/db/sql-writing/shared";
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
};
