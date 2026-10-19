import {
  BARE_TYPE_FAMILY,
  CLICKHOUSE_WRAPPER,
  EXACT_DECIMAL_TYPE_NAMES,
  EXACT_NUMERIC_TYPE,
  FLOAT64_TYPE_NAMES,
  FLOAT_TYPE,
  identifierDoubleQuoted,
  INSTANT_TYPE_NAMES,
  literalBackslash,
  NO_BARE_SPELLING,
  NOTHING_STANDS_ALONE,
  NULL_NON_FINITE,
  placeholderDollar,
  STANDARD_DDL_TYPES,
  unquoteBackslash,
} from "@/lib/db/sql-writing/shared";
import { binaryTextBackslash } from "@/lib/db/sql-writing/export-shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Couchbase. */
export const COUCHBASE_SQL_WRITING: SqlWritingSpec = {
  // SQL++ spells its literals the way JSON does: `char ::= unicode-character |
  // '\' ( '\' | '"' | "'" | 'b' | 'f' | 'n' | 'r' | 't' | 'u' hex hex hex hex )`.
  // Doubling is not in that grammar, so a doubled quote is not one literal there.
  escapeLiteral: literalBackslash,
  unescapeLiteral: unquoteBackslash,
  // The SQL standard form, which this engine's generators fall back to.
  quoteIdentifier: identifierDoubleQuoted,
  // SQL++ takes its values in `args`, which the statement reads as `$1`, `$2`.
  placeholder: placeholderDollar,
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
