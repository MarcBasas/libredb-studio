/**
 * The SQL grammar registry is total over the type ids, each row is the module at its placement next to the
 * provider (spec 5.3), and the two named specs answer an absent and an unknown type.
 */
import { describe, expect, test } from "bun:test";
import { EXTERNAL_DATABASE_TYPES } from "@/lib/db/compatibility";
import { SQL_GRAMMAR, sqlGrammarFor } from "@/lib/db/sql-grammar";
import { NO_CONNECTION_SQL_GRAMMAR } from "@/lib/db/sql-grammar/no-connection";
import type { SqlGrammarSpec } from "@/lib/db/sql-grammar/types";
import { UNKNOWN_TYPE_SQL_GRAMMAR } from "@/lib/db/sql-grammar/unknown-type";
import type { DatabaseType } from "@/lib/types";

const FLAT: Partial<Record<DatabaseType, string>> = {
  postgres: "sql/postgres-sql-grammar",
  mysql: "sql/mysql-sql-grammar",
  mssql: "sql/mssql-sql-grammar",
  oracle: "sql/oracle-sql-grammar",
  sqlite: "sql/sqlite-sql-grammar",
  redis: "keyvalue/redis-sql-grammar",
  libredb: "embedded/libredb-sql-grammar",
  elasticsearch: "sql/search/elasticsearch-sql-grammar",
  opensearch: "sql/search/opensearch-sql-grammar",
  influxdb: "timeseries/influxdb/influxdb-sql-grammar",
  influxdb3: "timeseries/influxdb/influxdb3-sql-grammar",
};

const FAMILIES: Record<string, readonly DatabaseType[]> = {
  document: ["couchbase", "firestore", "mongodb"],
  graph: ["neo4j"],
  industrial: ["modbus", "mtconnect", "opcua", "sparkplug"],
  keyvalue: ["etcd", "mqtt", "oxia"],
  network: ["netconf", "snmp"],
  objectstore: ["s3"],
  platform: ["kubernetes"],
  sql: [
    "bigquery",
    "cassandra",
    "clickhouse",
    "databend",
    "db2",
    "druid",
    "duckdb",
    "libsql",
    "snowflake",
    "spark",
    "trino",
  ],
  stream: ["kafka", "rabbitmq"],
  timeseries: ["prometheus"],
  vector: ["milvus", "qdrant"],
};

/** Where each type id's module sits, under `src/lib/db/providers/`. */
const PLACEMENT: Record<string, string> = { ...FLAT };
for (const [family, ids] of Object.entries(FAMILIES)) {
  for (const id of ids) PLACEMENT[id] = `${family}/${id}/sql-grammar`;
}

const ALL_IDS = [...EXTERNAL_DATABASE_TYPES, "libredb"].sort();

describe("the SQL grammar registry", () => {
  test("has one row per type id and no other", () => {
    expect(Object.keys(SQL_GRAMMAR).sort()).toEqual(ALL_IDS);
    expect(Object.keys(PLACEMENT).sort()).toEqual(ALL_IDS);
    expect(Object.isFrozen(SQL_GRAMMAR)).toBe(true);
  });

  for (const id of ALL_IDS) {
    test(`${id}'s row is the module at its placement`, async () => {
      const declared = (await import(`@/lib/db/providers/${PLACEMENT[id]}`)) as Record<string, SqlGrammarSpec>;
      expect(declared[`${id.toUpperCase()}_SQL_GRAMMAR`]).toBe(SQL_GRAMMAR[id as DatabaseType]);
    });
  }

  test("the rows are pairwise distinct objects", () => {
    expect(new Set(Object.values(SQL_GRAMMAR)).size).toBe(ALL_IDS.length);
  });

  test("only sqlite and libsql share a grammar object", () => {
    const owners = new Map<object, string[]>();
    for (const [id, spec] of Object.entries(SQL_GRAMMAR)) {
      if (spec.grammar === NO_CONNECTION_SQL_GRAMMAR.grammar) continue;
      owners.set(spec.grammar, [...(owners.get(spec.grammar) ?? []), id]);
    }
    const shared = [...owners.values()].filter((ids) => ids.length > 1).map((ids) => ids.sort());
    expect(shared).toEqual([["libsql", "sqlite"]]);
  });

  test("an absent type is the no-connection spec", () => {
    expect(sqlGrammarFor(undefined)).toBe(NO_CONNECTION_SQL_GRAMMAR);
  });

  test.each(["constructor", "__proto__", "not-an-engine"])("%s is the unknown-type spec", (type) => {
    expect(sqlGrammarFor(type)).toBe(UNKNOWN_TYPE_SQL_GRAMMAR);
  });

  test("the two named specs are distinct objects with equal facts", () => {
    expect(NO_CONNECTION_SQL_GRAMMAR).not.toBe(UNKNOWN_TYPE_SQL_GRAMMAR);
    expect(NO_CONNECTION_SQL_GRAMMAR).toEqual(UNKNOWN_TYPE_SQL_GRAMMAR);
  });
});
