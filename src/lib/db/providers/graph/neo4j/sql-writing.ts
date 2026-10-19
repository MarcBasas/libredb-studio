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
  STANDARD_DDL_TYPES,
  unquoteBackslash,
} from "@/lib/db/sql-writing/shared";
import { binaryStandardHex } from "@/lib/db/sql-writing/export-shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Neo4j. */
export const NEO4J_SQL_WRITING: SqlWritingSpec = {
  // Cypher spells its escapes with a backslash (`\'`, `\"`, `\\`, `\n`, `\uXXXX`), and a doubled quote is
  // not one of them: it closes one string and opens the next. The graph lexer
  // (`src/lib/db/graph/cypher/lexer.ts`) decodes the same set, so the two read a literal alike.
  escapeLiteral: literalBackslash,
  unescapeLiteral: unquoteBackslash,
  // The SQL standard form, which this engine's generators fall back to.
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
    // Cypher, not SQL: it has no INSERT and no byte literal, so no statement is built for it either.
    binaryLiteral: binaryStandardHex,
    nonFinite: NULL_NON_FINITE,
    insertForm: "values",
  },
};
