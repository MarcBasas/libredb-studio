import {
  EXACT_DECIMAL_TYPE_NAMES,
  FLOAT64_TYPE_NAMES,
  INSTANT_TYPE_NAMES,
  identifierDoubleQuoted,
  literalStandard,
  placeholderColon,
  unquoteStandard,
} from "@/lib/db/sql-writing/shared";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";

/** The declared types the Oracle provider reads as wall-clock text (#1131) or an instant (#1224). */
export const ORACLE_TIMESTAMP_TYPE = /^TIMESTAMP\s*(\(\d\))?$/;
export const ORACLE_ZONED_TIMESTAMP_TYPE = /^TIMESTAMP\s*(\(\d\))?\s+WITH\s+(LOCAL\s+)?TIME\s+ZONE$/;

/** The masks `TO_DATE` and `TO_TIMESTAMP` read the provider's text and the `Date` fields through (#1131, #1498). */
export const ORACLE_DATE_MASK = "YYYY-MM-DD HH24:MI:SS";
export const ORACLE_BC_DATE_MASK = "SYYYY-MM-DD HH24:MI:SS";

/**
 * The text the Oracle provider reads a DATE and a TIMESTAMP as (#1131): the wall clock,
 * a leading `-` on a BC year, and a fraction only where there is one.
 */
export const ORACLE_ZONELESS_TEXT = /^(-?)\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,9})?$/;

/**
 * The text `Date#toISOString` writes for a year from 0000 to 9999. A year outside that
 * range is written with a sign and six digits (`-000044-…`, `+012026-…`) and does not
 * match: Oracle has no year after 9999, and a BC year's text is left for a separate change
 * (the `Date` path itself writes one as `SYYYY`, #1498), so that text stays quoted.
 */
export const ISO_INSTANT_TEXT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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
  inlineEdit: {
    instantTypeNames: INSTANT_TYPE_NAMES,
    exactDecimalTypeNames: EXACT_DECIMAL_TYPE_NAMES,
    float64TypeNames: FLOAT64_TYPE_NAMES,
    /**
     * An Oracle `DATE`, `TIMESTAMP` or `TIMESTAMP WITH [LOCAL] TIME ZONE` edit wrapped around its
     * `:n` bind placeholder, or `undefined` when the column or text is not one (#1807).
     *
     * The Oracle provider reads `DATE` and `TIMESTAMP` as their wall clock (`YYYY-MM-DD HH24:MI:SS[.FF]`,
     * #1131) and `TIMESTAMP WITH [LOCAL] TIME ZONE` arrives over HTTP as its `Date#toISOString` text
     * (`YYYY-MM-DDTHH:MM:SS.sssZ`, #1224). `oracledb` binds a string parameter as `DB_TYPE_VARCHAR`, which
     * Oracle reads into a date or timestamp column through the session's `NLS_DATE_FORMAT` (`DD-MON-RR`),
     * `NLS_TIMESTAMP_FORMAT` (`DD-MON-RR HH.MI.SSXFF AM`), or `NLS_TIMESTAMP_TZ_FORMAT`
     * (`DD-MON-RR HH.MI.SSXFF AM TZR`). MEASURED 2026-10-18 on Oracle AI Database 26ai Free 23.26.3.0.0
     * (`gvenzl/oracle-free:slim`, `oracledb` 26.0.0, `TZ=Europe/Istanbul`): a bare `:1` bind was refused
     * with `ORA-01861: literal does not match format string` on `DATE` and `ORA-01843: An invalid month
     * was specified.` on `TIMESTAMP`, `TIMESTAMP WITH TIME ZONE`, and `TIMESTAMP WITH LOCAL TIME ZONE`,
     * while `:1` wrapped in `TO_DATE(:1, '[S]YYYY-MM-DD HH24:MI:SS')`, `TO_TIMESTAMP(:1,
     * '[S]YYYY-MM-DD HH24:MI:SS[.FF]')`, or `FROM_TZ(TO_TIMESTAMP(:1, 'YYYY-MM-DD HH24:MI:SS.FF3'), 'UTC')`
     * stored each value equal on the server, BC dates included. Matched by the same regexes and masks the
     * SQL INSERT export uses (`result-export.ts`). Everything else returns `undefined` and binds as `:n`.
     */
    boundEdit: (text, declaredType, bind) => {
      const bare = declaredType?.trim().toUpperCase() ?? "";
      if (bare === "DATE" || ORACLE_TIMESTAMP_TYPE.test(bare)) {
        const match = ORACLE_ZONELESS_TEXT.exec(text);
        if (match === null) return undefined;
        const [, sign, fraction] = match;
        const mask = sign === "" ? ORACLE_DATE_MASK : ORACLE_BC_DATE_MASK;
        if (bare === "DATE") return fraction === undefined ? `TO_DATE(${bind(text)}, '${mask}')` : undefined;
        return `TO_TIMESTAMP(${bind(text)}, '${mask}${fraction === undefined ? "" : ".FF"}')`;
      }
      if (ORACLE_ZONED_TIMESTAMP_TYPE.test(bare) && ISO_INSTANT_TEXT.test(text)) {
        const instant = new Date(text);
        if (!Number.isNaN(instant.getTime()) && instant.toISOString() === text) {
          return `FROM_TZ(TO_TIMESTAMP(${bind(text.slice(0, -1).replace("T", " "))}, '${ORACLE_DATE_MASK}.FF3'), 'UTC')`;
        }
      }
      return undefined;
    },
  },
};
