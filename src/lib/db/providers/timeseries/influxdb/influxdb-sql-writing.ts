import {
  EXACT_DECIMAL_TYPE_NAMES,
  FLOAT64_TYPE_NAMES,
  INSTANT_TYPE_NAMES,
  identifierDoubleQuoted,
  literalBackslash,
  unquoteBackslash,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for InfluxDB 1.x. */
export const INFLUXDB_SQL_WRITING: SqlWritingSpec = {
  // Measured on InfluxDB 1.13.1: `... WHERE room = 'it\'s'` parses and `... WHERE room = 'it''s'`
  // is `error parsing query: found s, expected ;`; the scanner's string escapes are exactly `\n`,
  // `\\`, `\"` and `\'`. No generator calls `quoteLiteral` for InfluxQL: the provider's
  // `influxql-quote.ts` builds every literal and refuses a newline, which a backslash form cannot
  // carry. The row is the true answer for any future caller.
  escapeLiteral: literalBackslash,
  unescapeLiteral: unquoteBackslash,
  // The SQL standard form, which this engine's generators fall back to.
  quoteIdentifier: identifierDoubleQuoted,
  // InfluxQL is not SQL, and nothing binds there.
  placeholder: null,
  temporalLiteral: null,
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
  },
};
