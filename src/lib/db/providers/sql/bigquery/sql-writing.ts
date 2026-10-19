import {
  BARE_TYPE_FAMILY,
  CLICKHOUSE_WRAPPER,
  EXACT_DECIMAL_TYPE_NAMES,
  EXACT_NUMERIC_TYPE,
  FLOAT64_TYPE_NAMES,
  FLOAT_TYPE,
  identifierBacktickBackslash,
  INSTANT_TYPE_NAMES,
  literalBackslash,
  NO_BARE_SPELLING,
  NOTHING_STANDS_ALONE,
  NULL_NON_FINITE,
  STANDARD_DDL_TYPES,
  unquoteBackslash,
} from "@/lib/db/sql-writing/shared";
import { binaryTextBackslash } from "@/lib/db/sql-writing/export-shared";
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
  export: {
    ddlTypes: STANDARD_DDL_TYPES,
    standsAlone: NOTHING_STANDS_ALONE,
    bareSpelling: NO_BARE_SPELLING,
    typeVocabulary: {
      bareTypeFamily: BARE_TYPE_FAMILY,
      floatType: FLOAT_TYPE,
      exactNumericType: EXACT_NUMERIC_TYPE,
      numericWrapper: CLICKHOUSE_WRAPPER,
    },
    binaryLiteral: binaryTextBackslash,
    nonFinite: NULL_NON_FINITE,
    insertForm: "values",
  },
};
