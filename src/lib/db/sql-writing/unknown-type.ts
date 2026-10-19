import { binaryStandardHex } from "./export-shared";
import {
  BARE_TYPE_FAMILY,
  CLICKHOUSE_WRAPPER,
  EXACT_DECIMAL_TYPE_NAMES,
  EXACT_NUMERIC_TYPE,
  FLOAT64_TYPE_NAMES,
  FLOAT_TYPE,
  INSTANT_TYPE_NAMES,
  identifierDoubleQuoted,
  literalDoubleAndBackslash,
  unquoteDoublingOnly,
  NO_BARE_SPELLING,
  NOTHING_STANDS_ALONE,
  NULL_NON_FINITE,
  STANDARD_DDL_TYPES,
} from "./shared";
import type { SqlWritingSpec } from "./types";

/**
 * What a string outside the `DatabaseType` union gets, which is what it got before the
 * registry (spec 2.3): `QuerySafetyDialog` takes `databaseType?: string`, so such a string
 * does reach a reader.
 *
 * A literal doubles both the quote and the backslash, because no table row named the string
 * and the old writer fell through to that branch; a literal is read back with doubling only;
 * a name gets the standard quoting; and there is no placeholder or temporal form.
 */
export const UNKNOWN_TYPE_SQL_WRITING: SqlWritingSpec = {
  escapeLiteral: literalDoubleAndBackslash,
  unescapeLiteral: unquoteDoublingOnly,
  quoteIdentifier: identifierDoubleQuoted,
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
    binaryLiteral: binaryStandardHex,
    nonFinite: NULL_NON_FINITE,
    insertForm: "values",
  },
};
