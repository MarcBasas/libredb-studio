import { identifierBacktickDoubled, literalBackslash, unquoteBackslash } from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Spark. */
export const SPARK_SQL_WRITING: SqlWritingSpec = {
  // Spark's lexer pairs a backslash with the next character inside '...' under every setting, so the quote is written
  // \' as Spark's own Literal.sql writes it; a doubled quote is an escape only from 4.1, so it is not used.
  escapeLiteral: literalBackslash,
  unescapeLiteral: unquoteBackslash,
  // Spark SQL (4.1 and 4.2) quotes a name in backticks and doubles a backtick inside it, the form its own
  // quoteIfNeeded writes; a double-quoted text is a string literal in Spark, so the standard form
  // would turn a name into a string. Names are case-insensitive there, so quoting never changes which object a
  // name means.
  quoteIdentifier: identifierBacktickDoubled,
  placeholder: null,
  temporalLiteral: null,
};
