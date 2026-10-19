import {
  EXACT_DECIMAL_TYPE_NAMES,
  FLOAT64_TYPE_NAMES,
  INSTANT_TYPE_NAMES,
  identifierBacktickDoubled,
  literalDoubleAndBackslash,
  unquoteDoubleAndBackslash,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Databend. */
export const DATABEND_SQL_WRITING: SqlWritingSpec = {
  // Databend reads both escapes in a single-quoted string in every one of its five `sql_dialect`s: a doubled quote
  // is one quote and a backslash escapes the next character, so it is doubled first (design 5.1). The live round
  // trip of the escaping corpus, `INSERT ... VALUES` included, passed on the pinned image (L4).
  escapeLiteral: literalDoubleAndBackslash,
  unescapeLiteral: unquoteDoubleAndBackslash,
  // Databend reads a backtick name in all five of its `sql_dialect`s, the default
  // PostgreSQL one included, and a doubled backtick is the only escape inside it: the
  // lexer rule has no backslash form, so `x\` is the name `x\`. Measured on the pinned
  // image (probe L4): names holding a backtick, a backslash, a quote, `;`, `--`, a
  // newline or a NUL round-trip byte-equal through CREATE TABLE, INSERT and SELECT
  // under both dialects. A bare name would be folded to lower case there, which is why
  // the provider quotes every name rather than only the ones that need it.
  quoteIdentifier: identifierBacktickDoubled,
  placeholder: null,
  temporalLiteral: null,
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
  },
};
