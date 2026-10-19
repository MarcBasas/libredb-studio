import {
  EXACT_DECIMAL_TYPE_NAMES,
  FLOAT64_TYPE_NAMES,
  firstWord,
  identifierBracket,
  INSTANT_TYPE_NAMES,
  literalUnicode,
  placeholderAtP,
  unquoteUnicode,
  unwrappedType,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/**
 * The text the provider reads a `datetime` and a `smalldatetime` as (#1452): the engine's own.
 * The inline grid edit (`use-inline-editing.ts`) binds it with a `T` for the same reason the
 * SQL INSERT export (`typed-literals.ts`) writes it with one.
 */
export const MSSQL_DATETIME_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,3})?$/;

/**
 * The SQL Server types that read `yyyy-mm-dd hh:mi:ss` through the session's DATEFORMAT.
 * `datetime2` and `date` read it the same under every DATEFORMAT, so they are not here.
 */
const MSSQL_DATEFORMAT_TYPES: ReadonlySet<string> = new Set(["datetime", "smalldatetime"]);

/** How a generated statement spells a literal, a name and a bind for SQL Server. */
export const MSSQL_SQL_WRITING: SqlWritingSpec = {
  // SQL Server parses a BARE literal in the database's collation code page and only an
  // `N`-prefixed one as Unicode, so the prefix is not decoration: every catalog name in
  // `sys` is `sysname`, which is `nvarchar(128)`.
  // Measured on SQL Server 2022 CU26, database AdventureWorks2022, collation
  // `SQL_Latin1_General_CP1_CI_AS` (code page 1252), with schemas `Müşteri` and `Müsteri`
  // both present: `SELECT 'Müşteri'` answers `Müsteri`, because `ş` (U+015F) is not in
  // 1252 and the server best-fits it to `s`. So `… WHERE s.name = 'Müşteri'` matched
  // `Müsteri.Siparis` - THE WRONG OBJECT - while `… WHERE s.name = N'Müşteri'` matched
  // `Müşteri.Sipariş`. With no `Müsteri` present the bare form matched nothing at all.
  // Both failures are silent, which is why this dialect does not share the `standard`
  // row: the escaping is the same, the code page is not.
  escapeLiteral: literalUnicode,
  unescapeLiteral: unquoteUnicode,
  quoteIdentifier: identifierBracket,
  // The mssql provider registers its inputs as `p1`, `p2`, … which the statement spells `@p1`, `@p2`.
  placeholder: placeholderAtP,
  temporalLiteral: null,
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
    /**
     * The edited text as it is bound: as typed, except the one form SQL Server reads by DATEFORMAT.
     *
     * The provider reads a `datetime` and a `smalldatetime` as the engine's own
     * `yyyy-mm-dd hh:mi:ss[.mmm]` text (#1452), and the grid opens its editor on that text. Bound
     * as it is, the nvarchar parameter reaches those two columns through the session's DATEFORMAT.
     * MEASURED 2026-10-12 on SQL Server 2022 CU27 (16.0.4295.3), this hook's own `UPDATE ... SET
     * [dt] = @p1` in a session under `british`: `2026-10-04 12:34:57.123` was stored as April 10th
     * and `2026-10-25 23:59:58.997` was refused as out of range, while the same text with a `T`
     * was stored as written, and a `smalldatetime` the same. This provider's own sessions read
     * `mdy` today - tedious opens each one with `set dateformat mdy` and `set language
     * us_english`, and a `SET LANGUAGE` a user runs ends with its own `sp_executesql` call - so the
     * `T` keeps the edit from leaning on that driver default, the way the SQL INSERT export does
     * (`typed-literals.ts`). Text in any other shape is bound as typed.
     */
    boundEdit: (text, declaredType, bind) =>
      declaredType !== undefined &&
      MSSQL_DATEFORMAT_TYPES.has(firstWord(unwrappedType(declaredType))) &&
      MSSQL_DATETIME_TEXT.test(text)
        ? bind(text.replace(" ", "T"))
        : undefined,
  },
};
