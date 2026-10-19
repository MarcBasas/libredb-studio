import {
  identifierBacktickDoubled,
  literalDoubleAndBackslash,
  placeholderQuestion,
  unquoteDoubleAndBackslash,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for MySQL. */
export const MYSQL_SQL_WRITING: SqlWritingSpec = {
  // Default `sql_mode`. A server running with NO_BACKSLASH_ESCAPES reads the
  // doubled backslash as two characters, which is why binding the value beats
  // quoting it wherever a bind form exists.
  escapeLiteral: literalDoubleAndBackslash,
  unescapeLiteral: unquoteDoubleAndBackslash,
  quoteIdentifier: identifierBacktickDoubled,
  // `mysql2` takes `?`.
  placeholder: placeholderQuestion,
  temporalLiteral: null,
};
