import { identifierDoubleQuoted, literalBackslash, unquoteBackslash } from "@/lib/db/sql-writing/shared";
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
};
