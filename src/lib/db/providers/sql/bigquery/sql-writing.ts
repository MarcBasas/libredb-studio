import {
  EXACT_DECIMAL_TYPE_NAMES,
  FLOAT64_TYPE_NAMES,
  INSTANT_TYPE_NAMES,
  identifierBacktickBackslash,
  literalBackslash,
  unquoteBackslash,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for BigQuery. */
export const BIGQUERY_SQL_WRITING: SqlWritingSpec = {
  // GoogleSQL escapes the quote as \\' and does not accept doubling.
  escapeLiteral: literalBackslash,
  unescapeLiteral: unquoteBackslash,
  // GoogleSQL quotes a name in backticks and escapes inside it with a backslash; a doubled
  // backtick is not an escape there, it ends the name.
  quoteIdentifier: identifierBacktickBackslash,
  placeholder: null,
  temporalLiteral: null,
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
  },
};
