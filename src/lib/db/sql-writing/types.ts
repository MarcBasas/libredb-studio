/**
 * The SQL writing contract: what one engine states about the literals, identifiers and
 * binds a generated statement spells for it.
 *
 * This is the values subset and the inline edit fields, `InlineEditSpec`. The export fields
 * arrive with row 4, so no field exists before the code that reads it.
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
  /** The key column kinds and bound edit the inline editor reads for this engine. */
  readonly inlineEdit: InlineEditSpec;
}

/**
 * What one engine states about the inline edit's key columns and the value an edit writes.
 *
 * A key column's declared type is read down to its first word, and that word is looked up
 * here. The shared sets in `./shared` are the words most engines use; an engine that wants
 * one imports it by name.
 */
export interface InlineEditSpec {
  /** Type names that make a key column date-time. */
  readonly instantTypeNames: ReadonlySet<string>;
  /** Type names that make a key column exact decimal. */
  readonly exactDecimalTypeNames: ReadonlySet<string>;
  /** Type names that make a key column float64, or "all" where every declared key is float64. */
  readonly float64TypeNames: ReadonlySet<string> | "all";
  /** The SET right-hand side for one non-NULL edit, or undefined to bind the text unchanged. */
  readonly boundEdit?: (
    text: string,
    declaredType: string | undefined,
    bind: (value: string) => string,
  ) => string | undefined;
}
