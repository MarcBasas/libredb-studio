/**
 * The literal, identifier and placeholder forms more than one engine spells alike.
 *
 * An engine module imports the one it uses by name, so a change here shows in the golden
 * output of every engine that imports it, and nowhere else. This module is a leaf: it
 * imports nothing from the tree, so any engine module can import it first in a fresh
 * process.
 */
import type { SqlWritingSpec } from "./types";

type Escape = SqlWritingSpec["escapeLiteral"];
type Unescape = SqlWritingSpec["unescapeLiteral"];
type QuoteIdentifier = SqlWritingSpec["quoteIdentifier"];
type Placeholder = NonNullable<SqlWritingSpec["placeholder"]>;

// The quote is doubled and a backslash is ordinary data.
export const literalStandard: Escape = (text) => `'${text.replace(/'/g, "''")}'`;

// Same escaping as `literalStandard`, plus the `N` prefix that decides which character set
// the server reads the escaped text in: without it the characters are not Unicode at all.
export const literalUnicode: Escape = (text) => `N${literalStandard(text)}`;

// The backslash goes first in both remaining forms: doubling it afterwards would also
// double the one just added in front of a quote. A value ending in `\` would otherwise
// escape the closing quote and everything after it would be read as SQL (issue #290).

// The quote is doubled, and a backslash escapes, so it has to be doubled too.
export const literalDoubleAndBackslash: Escape = (text) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;

// Every escape is spelled with a backslash, including the quote; doubling is not part of the grammar.
export const literalBackslash: Escape = (text) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/**
 * What a backslash escape decodes to in the dialects that have them.
 *
 * `\%` and `\_` are the documented exceptions: MySQL keeps BOTH characters, because the
 * pair exists for `LIKE` and not for the string. Anything not named here decodes to the
 * escaped character itself.
 */
const BACKSLASH_ESCAPES: Readonly<Record<string, string>> = {
  "0": "\u0000",
  b: "\b",
  n: "\n",
  r: "\r",
  t: "\t",
  Z: "\u001a",
  "\\": "\\",
  "'": "'",
  '"': '"',
  "%": "\\%",
  _: "\\_",
};

interface QuotedGrammar {
  /** The literal may carry an `N` prefix, which is part of what is read. */
  readonly nPrefix: boolean;
  /** A doubled quote is one quote. */
  readonly doubles: boolean;
  /** A backslash escapes the next character. */
  readonly backslashes: boolean;
}

/**
 * The value inside a single-quoted literal, or `undefined` when `literal` is not exactly one.
 *
 * The `undefined` answer is half the contract, not an error path. A catalog that reports a
 * default as the expression AS WRITTEN hands its reader string literals and bare
 * expressions through the same column, so "is this one literal" is the question the caller
 * needs answered, and the answer has to come from the grammar. A literal that CLOSES before
 * the end of the text is not one literal: `'a' = 'b'` is an expression, and stripping its
 * outer quotes would produce `a' = 'b`, a value nobody wrote.
 *
 * One left-to-right scan rather than a chain of replaces. The writers have to order their
 * two escapes, for the reason written above them; a scanner has no second pass to order.
 */
function readQuoted(literal: string, grammar: QuotedGrammar): string | undefined {
  const body = grammar.nPrefix && literal.startsWith("N") ? literal.slice(1) : literal;
  if (body.length < 2 || !body.startsWith("'")) return undefined;

  let value = "";
  let at = 1;
  while (at < body.length) {
    const char = body[at];
    if (char === "'") {
      if (grammar.doubles && body[at + 1] === "'") {
        value += "'";
        at += 2;
        continue;
      }
      // The literal closed. It is the WHOLE text only if nothing follows the closing quote.
      return at === body.length - 1 ? value : undefined;
    }
    if (grammar.backslashes && char === "\\" && at + 1 < body.length) {
      const escaped = body[at + 1] as string;
      value += BACKSLASH_ESCAPES[escaped] ?? escaped;
      at += 2;
      continue;
    }
    value += char;
    at += 1;
  }
  // Ran off the end without closing, which a trailing backslash is one way to do.
  return undefined;
}

export const unquoteStandard: Unescape = (literal) =>
  readQuoted(literal, { nPrefix: false, doubles: true, backslashes: false });

export const unquoteUnicode: Unescape = (literal) =>
  readQuoted(literal, { nPrefix: true, doubles: true, backslashes: false });

export const unquoteDoubleAndBackslash: Unescape = (literal) =>
  readQuoted(literal, { nPrefix: false, doubles: true, backslashes: true });

export const unquoteBackslash: Unescape = (literal) =>
  readQuoted(literal, { nPrefix: false, doubles: false, backslashes: true });

/**
 * What a string outside the union gets today: a doubled quote is one quote, a backslash is
 * data, and no prefix is read. It reads exactly as `unquoteStandard` does, and is named
 * apart so the unknown-type answer does not move when the standard one does.
 */
export const unquoteDoublingOnly: Unescape = (literal) =>
  readQuoted(literal, { nPrefix: false, doubles: true, backslashes: false });

// Each identifier form doubles (or escapes) its own closing quote character, so a name
// holding it cannot end the quoted span and leave the rest to be parsed as statement text.

// The SQL standard form.
export const identifierDoubleQuoted: QuoteIdentifier = (name) => `"${name.replace(/"/g, '""')}"`;

// A backtick name, a doubled backtick inside it, and a backslash as data.
export const identifierBacktickDoubled: QuoteIdentifier = (name) => `\`${name.replace(/`/g, "``")}\``;

// A backtick name escaped inside with a backslash; a doubled backtick is not an escape there, it ends the name.
export const identifierBacktickBackslash: QuoteIdentifier = (name) =>
  `\`${name.replace(/\\/g, "\\\\").replace(/`/g, "\\`")}\``;

export const identifierBracket: QuoteIdentifier = (name) => `[${name.replace(/]/g, "]]")}]`;

export const placeholderDollar: Placeholder = (position) => `$${position}`;

export const placeholderQuestion: Placeholder = () => "?";

export const placeholderColon: Placeholder = (position) => `:${position}`;

export const placeholderAtP: Placeholder = (position) => `@p${position}`;
