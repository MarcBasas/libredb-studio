import {
  EXACT_DECIMAL_TYPE_NAMES,
  FLOAT64_TYPE_NAMES,
  INSTANT_TYPE_NAMES,
  identifierDoubleQuoted,
  literalStandard,
  unquoteStandard,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Cassandra. */
export const CASSANDRA_SQL_WRITING: SqlWritingSpec = {
  // Measured on Cassandra 5.0.9 (2026-08-20), both directions. Doubling is the
  // escape: `… WHERE name = 'O''Brien'` runs and matches nothing, so the literal
  // closed at the doubled pair. A backslash is DATA: `… WHERE name = 'a\\b'` runs,
  // and `… WHERE name = 'a\\'` runs too - the statement reached the server's
  // filtering check, which is only possible if the backslash did not escape the
  // quote that closed the literal.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form. Measured on 5.0.9: `SELECT "id" FROM probe.customers` returns the
  // column, a backtick is "no viable alternative at character '`'", and a
  // double-quoted STRING is a syntax error - so `"` is the name quote and nothing
  // else.
  quoteIdentifier: identifierDoubleQuoted,
  // CQL really does bind `?` positionally and `cassandra-driver` really does
  // bind an array against it - through a PREPARED statement, which is exactly what the
  // transport does not send (`prepare: false`, so a one-shot statement costs one round
  // trip and no server-side cache entry). `CassandraProvider.query()` therefore refuses a
  // non-empty params array outright, and emitting `?` here would build a statement whose
  // placeholder the provider then declines to fill.
  placeholder: null,
  temporalLiteral: null,
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
  },
};
