import { identifierDoubleQuoted, literalStandard, unquoteStandard } from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Sparkplug. */
export const SPARKPLUG_SQL_WRITING: SqlWritingSpec = {
  // No generator calls `quoteLiteral` for Sparkplug either: a read request writes its names into JSON.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form, which this engine's generators fall back to.
  quoteIdentifier: identifierDoubleQuoted,
  placeholder: null,
  temporalLiteral: null,
};
