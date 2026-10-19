import {
  identifierDoubleQuoted,
  literalStandard,
  placeholderQuestion,
  unquoteStandard,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for SQLite. */
export const SQLITE_SQL_WRITING: SqlWritingSpec = {
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form.
  quoteIdentifier: identifierDoubleQuoted,
  // The SQLite drivers take `?`.
  placeholder: placeholderQuestion,
  temporalLiteral: null,
};
