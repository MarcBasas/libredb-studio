import {
  EXACT_DECIMAL_TYPE_NAMES,
  FLOAT64_TYPE_NAMES,
  INSTANT_TYPE_NAMES,
  identifierDoubleQuoted,
  literalStandard,
  placeholderQuestion,
  unquoteStandard,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Db2. */
export const DB2_SQL_WRITING: SqlWritingSpec = {
  // Measured on Db2 LUW 12.1.0.0 through db2-node 1.0.22 (#786), both directions: `VALUES
  // 'O''Brien'` answers `O'Brien`, and `VALUES 'a\b'` answers the three characters `a\b` with
  // `LENGTH` 3, so a backslash is data.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  quoteIdentifier: identifierDoubleQuoted,
  // db2-node binds a params array against `?`, measured on Db2 LUW 12.1.0.0 (#786).
  placeholder: placeholderQuestion,
  temporalLiteral: null,
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
  },
};
