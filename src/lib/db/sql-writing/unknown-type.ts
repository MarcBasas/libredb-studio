import { identifierDoubleQuoted, literalDoubleAndBackslash, unquoteDoublingOnly } from "./shared";
import type { SqlWritingSpec } from "./types";

/**
 * What a string outside the `DatabaseType` union gets, which is what it got before the
 * registry (spec 2.3): `QuerySafetyDialog` takes `databaseType?: string`, so such a string
 * does reach a reader.
 *
 * A literal doubles both the quote and the backslash, because no table row named the string
 * and the old writer fell through to that branch; a literal is read back with doubling only;
 * a name gets the standard quoting; and there is no placeholder or temporal form.
 */
export const UNKNOWN_TYPE_SQL_WRITING: SqlWritingSpec = {
  escapeLiteral: literalDoubleAndBackslash,
  unescapeLiteral: unquoteDoublingOnly,
  quoteIdentifier: identifierDoubleQuoted,
  placeholder: null,
  temporalLiteral: null,
};
