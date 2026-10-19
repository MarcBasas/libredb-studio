import {
  identifierDoubleQuoted,
  literalStandard,
  placeholderColon,
  unquoteStandard,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** How a generated statement spells a literal, a name and a bind for Oracle. */
export const ORACLE_SQL_WRITING: SqlWritingSpec = {
  escapeLiteral: literalStandard,
  unescapeLiteral: unquoteStandard,
  // The SQL standard form.
  quoteIdentifier: identifierDoubleQuoted,
  // `oracledb` binds an array to `:n`.
  placeholder: placeholderColon,
  /**
   * Oracle reads a quoted string in a date position through the session's `NLS_DATE_FORMAT`,
   * `DD-MON-RR` by default, and refuses the ISO text with `ORA-01861: literal does not match
   * format string` (#1400, on Oracle 23.26.3.0.0; the SQL export measured the same refusal for
   * all four date types, `docs/providers/oracle.md`). So the value goes through `TO_DATE` or
   * `TO_TIMESTAMP` with a mask that spells the text's own form, as the export writes the same
   * types, and the session's format moves nothing. Text that is not in that form is quoted as
   * it is: the mask would refuse it, and a plain literal says what the caller had.
   */
  temporalLiteral: (text, kind) => {
    if (kind === "date") {
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `TO_DATE('${text}', 'YYYY-MM-DD')` : undefined;
    }
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
      ? `TO_TIMESTAMP('${text}', 'YYYY-MM-DD HH24:MI:SS')`
      : undefined;
  },
};
