import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SQL_WRITING } from "@/lib/db/sql-writing";
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
    });
  }
});
