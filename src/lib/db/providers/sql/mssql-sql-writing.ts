import { identifierBracket, literalUnicode, placeholderAtP, unquoteUnicode } from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

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
};
