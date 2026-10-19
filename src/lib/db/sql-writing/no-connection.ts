import { identifierDoubleQuoted, literalStandard, unquoteStandard } from "./shared";
import type { SqlWritingSpec } from "./types";

/**
 * What a generator with no connection to name an engine writes.
 *
 * It gets the standard literal, matching the standard identifier quoting such a generator
 * already emits: doubling the backslash there would corrupt the value on every dialect that
 * reads it as data, which is the larger group. A generator with no connection to name one
 * can claim only the standard.
 */
export const NO_CONNECTION_SQL_WRITING: SqlWritingSpec = {
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  quoteIdentifier: identifierDoubleQuoted,
  placeholder: null,
  temporalLiteral: null,
};
