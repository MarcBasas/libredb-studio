/**
 * The SQL writing contract: what one engine states about the literals, identifiers and
 * binds a generated statement spells for it.
 *
 * This is the values subset. The inline edit and export fields arrive with the changes
 * that move them, so no field exists before the code that reads it.
 *
 * Every fact is required. A `null` is an answer, not an omission: it says the engine has
 * no form of that kind, and the reader turns it into today's fallback.
 */
export interface SqlWritingSpec {
  /** The whole quoted literal for `text`, prefix included where the engine needs one. */
  readonly escapeLiteral: (text: string) => string;
  /** The value of a whole literal as the engine reads it, or `undefined` when `literal` is not exactly one. */
  readonly unescapeLiteral: (literal: string) => string | undefined;
  /** The name quoted and escaped so its closing quote character cannot end it. */
  readonly quoteIdentifier: (name: string) => string;
  /** The bind placeholder for the 1-based `position`, or `null` where the engine quotes the value instead. */
  readonly placeholder: ((position: number) => string) | null;
  /** A date or timestamp text as this engine's literal of that kind, or `undefined` to quote it; `null` always quotes. */
  readonly temporalLiteral: ((text: string, kind: "date" | "timestamp") => string | undefined) | null;
}
