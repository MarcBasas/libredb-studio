import {
  identifierDoubleQuoted,
  literalStandard,
  placeholderQuestion,
  unquoteStandard,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Druid. */
export const DRUID_SQL_WRITING: SqlWritingSpec = {
  // Druid quotes a string with single quotes and puts its backslash escapes in the
  // separate `U&'fo\00F6'` form, so a backslash in a plain literal is data.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form.
  quoteIdentifier: identifierDoubleQuoted,
  // Druid binds a `parameters` array against `?`, live-verified when the
  // provider was written (`src/lib/db/providers/sql/druid/index.ts`).
  placeholder: placeholderQuestion,
  temporalLiteral: null,
};
