import {
  identifierDoubleQuoted,
  literalDoubleAndBackslash,
  unquoteDoubleAndBackslash,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for ClickHouse. */
export const CLICKHOUSE_SQL_WRITING: SqlWritingSpec = {
  // Matches what the ClickHouse provider already does when it builds its own
  // literals (`src/lib/db/providers/sql/clickhouse/index.ts`).
  escapeLiteral: literalDoubleAndBackslash,
  unescapeLiteral: unquoteDoubleAndBackslash,
  // The SQL standard form.
  quoteIdentifier: identifierDoubleQuoted,
  // ClickHouse binds named parameters only and its provider refuses positional ones outright.
  placeholder: null,
  temporalLiteral: null,
};
