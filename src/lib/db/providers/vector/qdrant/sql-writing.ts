import { identifierDoubleQuoted, literalStandard, unquoteStandard } from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Qdrant. */
export const QDRANT_SQL_WRITING: SqlWritingSpec = {
  // This engine declares `queryLanguage: "json"`, so no statement is ever built for it to
  // read. What a generator emits for such a connection is portable SQL meant to run elsewhere,
  // and the standard form is the only thing it can claim.
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form, which this engine's generators fall back to.
  quoteIdentifier: identifierDoubleQuoted,
  placeholder: null,
  temporalLiteral: null,
};
