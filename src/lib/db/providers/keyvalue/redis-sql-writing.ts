import {
  EXACT_DECIMAL_TYPE_NAMES,
  FLOAT64_TYPE_NAMES,
  INSTANT_TYPE_NAMES,
  identifierDoubleQuoted,
  literalStandard,
  unquoteStandard,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Redis. */
export const REDIS_SQL_WRITING: SqlWritingSpec = {
  // This engine declares `queryLanguage: "json"`, so no statement is ever built for it to
  // read. What a generator emits for such a connection is portable SQL meant to run elsewhere,
  // and the standard form is the only thing it can claim.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form, which this engine's generators fall back to.
  quoteIdentifier: identifierDoubleQuoted,
  // This engine declares `queryLanguage: "json"`, so no SQL statement binds anything for it.
  // `null` is the signal to quote the value with `quoteLiteral` instead, never to emit a
  // placeholder nothing will bind.
  placeholder: null,
  temporalLiteral: null,
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
  },
};
