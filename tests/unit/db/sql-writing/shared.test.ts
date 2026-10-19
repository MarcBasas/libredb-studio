import { describe, expect, test } from "bun:test";
import {
  identifierBacktickBackslash,
  identifierBacktickDoubled,
  identifierBracket,
  identifierDoubleQuoted,
  literalBackslash,
  literalDoubleAndBackslash,
  literalStandard,
  literalUnicode,
  placeholderAtP,
  placeholderColon,
  placeholderDollar,
  placeholderQuestion,
  unquoteBackslash,
  unquoteDoubleAndBackslash,
  unquoteDoublingOnly,
  unquoteStandard,
  unquoteUnicode,
} from "@/lib/db/sql-writing/shared";
import { quoteIdentifier } from "@/lib/sql/identifier";
import { positionalPlaceholder, quoteLiteral, unquoteLiteral } from "@/lib/sql/values";
import type { DatabaseType } from "@/lib/types";
import { IDENTIFIER_NAMES, LITERAL_VALUES, PLACEHOLDER_POSITIONS, RAW_LITERALS } from "./fixtures";

/**
 * Each shared building block answers what today's public function answers for one engine
 * of that form, over the golden fixture values, so an engine module that imports one by
 * name inherits today's output and nothing else.
 */
const LITERALS: ReadonlyArray<
  readonly [DatabaseType, (text: string) => string, (literal: string) => string | undefined]
> = [
  ["postgres", literalStandard, unquoteStandard],
  ["mssql", literalUnicode, unquoteUnicode],
  ["mysql", literalDoubleAndBackslash, unquoteDoubleAndBackslash],
  ["bigquery", literalBackslash, unquoteBackslash],
];

const IDENTIFIERS: ReadonlyArray<readonly [DatabaseType, (name: string) => string]> = [
  ["postgres", identifierDoubleQuoted],
  ["mysql", identifierBacktickDoubled],
  ["bigquery", identifierBacktickBackslash],
  ["mssql", identifierBracket],
];

const PLACEHOLDERS: ReadonlyArray<readonly [DatabaseType, (position: number) => string]> = [
  ["postgres", placeholderDollar],
  ["mysql", placeholderQuestion],
  ["oracle", placeholderColon],
  ["mssql", placeholderAtP],
];

describe("SQL writing shared building blocks", () => {
  for (const [engine, escape, unescape] of LITERALS) {
    test(`${escape.name} and ${unescape.name} answer as ${engine} does today`, () => {
      for (const value of LITERAL_VALUES) {
        const quoted = quoteLiteral(value, engine);
        expect(escape(value)).toBe(quoted);
        expect(unescape(escape(value))).toBe(unquoteLiteral(quoted, engine));
      }
      for (const raw of RAW_LITERALS) {
        expect(unescape(raw)).toBe(unquoteLiteral(raw, engine));
      }
    });
  }

  for (const [engine, quote] of IDENTIFIERS) {
    test(`${quote.name} answers as ${engine} does today`, () => {
      for (const name of IDENTIFIER_NAMES) {
        expect(quote(name)).toBe(quoteIdentifier(name, engine));
      }
    });
  }

  for (const [engine, placeholder] of PLACEHOLDERS) {
    test(`${placeholder.name} answers as ${engine} does today`, () => {
      for (const position of PLACEHOLDER_POSITIONS) {
        expect(placeholder(position)).toBe(positionalPlaceholder(engine, position) as string);
      }
    });
  }

  test("unquoteDoublingOnly reads a doubled quote and not a backslash escape", () => {
    expect(unquoteDoublingOnly("'a''b'")).toBe("a'b");
    expect(unquoteDoublingOnly("'a\\'b'")).toBeUndefined();
  });
});
