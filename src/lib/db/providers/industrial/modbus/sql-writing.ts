import { identifierDoubleQuoted, literalStandard, unquoteStandard } from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Modbus. */
export const MODBUS_SQL_WRITING: SqlWritingSpec = {
  // No generator calls `quoteLiteral` for Modbus either: a read request is JSON and names points.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form, which this engine's generators fall back to.
  quoteIdentifier: identifierDoubleQuoted,
  placeholder: null,
  temporalLiteral: null,
};
