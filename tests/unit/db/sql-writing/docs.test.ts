import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SQL_WRITING } from "@/lib/db/sql-writing";
import { EXACT_DECIMAL_TYPE_NAMES, FLOAT64_TYPE_NAMES, INSTANT_TYPE_NAMES } from "@/lib/db/sql-writing/shared";
import type { DatabaseType } from "@/lib/types";
import { ENGINE_MODULES, ROOT } from "./engine-modules";

/**
 * Each provider doc says how a generated statement spells that engine's literals, names and
 * binds, so the doc and the module beside the provider cannot drift (the provider triad).
 *
 * The `SQL writing` subsection links the module and names, by function name, the literal
 * writer and reader, the identifier form and the placeholder form the module uses. A `null`
 * placeholder is named as "no placeholder", and a temporal form, where one exists, by its
 * field name.
 *
 * It also names `inlineEdit`, and for each key-column name set either the shared set it
 * holds, by that set's name, or the field itself where the engine states its own set (or
 * `"all"`, quoted, for `float64TypeNames`). A `boundEdit`, where one exists, is named too.
 */
const HEADING = /^(#{2,4}) (?:\d+(?:\.\d+)*\.? +)?SQL writing$/gm;

function subsection(doc: string): string | undefined {
  const matches = [...doc.matchAll(HEADING)];
  if (matches.length !== 1) return undefined;
  const [match] = matches as [RegExpExecArray];
  const level = (match[1] as string).length;
  const rest = doc.slice((match.index as number) + match[0].length);
  const end = rest.search(new RegExp(`^#{1,${level}} `, "m"));
  return end === -1 ? rest : rest.slice(0, end);
}

const modulePath = new Map(ENGINE_MODULES.map((engine) => [engine.id, engine.repoPath]));

describe("provider docs name their SQL writing rules", () => {
  for (const type of Object.keys(SQL_WRITING) as DatabaseType[]) {
    const spec = SQL_WRITING[type];
    test(`${type}: one SQL writing subsection naming the module's building blocks`, () => {
      const doc = readFileSync(join(ROOT, "docs", "providers", `${type}.md`), "utf8");
      const section = subsection(doc);
      expect(section).toBeDefined();
      const text = section as string;
      expect(text).toContain(`../../${modulePath.get(type)}`);
      expect(text).toContain(`\`${spec.escapeLiteral.name}\``);
      expect(text).toContain(`\`${spec.unescapeLiteral.name}\``);
      expect(text).toContain(`\`${spec.quoteIdentifier.name}\``);
      if (spec.placeholder === null) {
        expect(text).toContain("no placeholder");
      } else {
        expect(text).toContain(`\`${spec.placeholder.name}\``);
      }
      if (spec.temporalLiteral !== null) expect(text).toContain("`temporalLiteral`");
      expect(text).toContain("`inlineEdit`");
      const { inlineEdit } = spec;
      const sets = [
        ["instantTypeNames", inlineEdit.instantTypeNames, INSTANT_TYPE_NAMES, "INSTANT_TYPE_NAMES"],
        ["float64TypeNames", inlineEdit.float64TypeNames, FLOAT64_TYPE_NAMES, "FLOAT64_TYPE_NAMES"],
        [
          "exactDecimalTypeNames",
          inlineEdit.exactDecimalTypeNames,
          EXACT_DECIMAL_TYPE_NAMES,
          "EXACT_DECIMAL_TYPE_NAMES",
        ],
      ] as const;
      for (const [field, value, shared, sharedName] of sets) {
        if (value === shared) {
          expect(text).toContain(`\`${sharedName}\``);
        } else {
          expect(text).toContain(`\`${field}\``);
          if (value === "all") expect(text).toContain('`"all"`');
        }
      }
      if (inlineEdit.boundEdit !== undefined) expect(text).toContain("`boundEdit`");
    });
  }
});
