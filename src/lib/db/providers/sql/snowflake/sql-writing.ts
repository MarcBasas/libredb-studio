import {
  identifierDoubleQuoted,
  literalDoubleAndBackslash,
  unquoteDoubleAndBackslash,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Snowflake. */
export const SNOWFLAKE_SQL_WRITING: SqlWritingSpec = {
  // Snowflake reads both escapes in a single-quoted string constant: a doubled quote is one quote, and a backslash
  // escapes the next character, so it is doubled first, as Databend's is.
  escapeLiteral: literalDoubleAndBackslash,
  unescapeLiteral: unquoteDoubleAndBackslash,
  quoteIdentifier: identifierDoubleQuoted,
  placeholder: null,
  temporalLiteral: null,
};
