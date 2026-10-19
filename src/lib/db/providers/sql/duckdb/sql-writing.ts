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

/** How a generated statement spells a literal, a name and a bind for DuckDB. */
export const DUCKDB_SQL_WRITING: SqlWritingSpec = {
  // Measured on DuckDB v1.5.5, both directions: `SELECT 'it''s'` answers `it's`, and
  // `SELECT 'a\b', length('a\b')` answers the three characters `a\b` - so a backslash
  // is data, and doubling it would add a second one to the value.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form. Measured on v1.5.5: `"quoted identifier"` works, and `[…]` is a
  // LIST literal here rather than a name quote, so the bracket form would be wrong for it.
  quoteIdentifier: identifierDoubleQuoted,
  // DuckDB binds BOTH forms - measured on v1.5.5, `runAndReadAll("SELECT ?::INTEGER
  // AS a, ?::VARCHAR AS b", [7, "x"])` and `runAndReadAll("SELECT $1::INTEGER AS a",
  // [9])` each answer - so this is a choice rather than a reading, and `?` is the one
  // taken. `$` is overloaded in this dialect: `$tag$…$tag$` is a dollar-quoted string
  // literal (measured), so a `$1` written into a generated statement sits one
  // character away from a form the readers in this folder have to tell apart, while
  // `?` has no second meaning anywhere in DuckDB's grammar. It also matches the
  // positional ORDER the driver binds by, which is the array's, not the digit's.
  placeholder: placeholderQuestion,
  temporalLiteral: null,
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
  },
};
