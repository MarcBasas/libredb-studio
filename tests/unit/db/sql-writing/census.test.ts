import { describe, expect, test } from "bun:test";
import { EXTERNAL_DATABASE_TYPES } from "@/lib/db/compatibility";
import { SQL_WRITING, sqlWritingFor } from "@/lib/db/sql-writing";
import { NO_CONNECTION_SQL_WRITING } from "@/lib/db/sql-writing/no-connection";
import { EXACT_DECIMAL_TYPE_NAMES, FLOAT64_TYPE_NAMES, INSTANT_TYPE_NAMES } from "@/lib/db/sql-writing/shared";
import { UNKNOWN_TYPE_SQL_WRITING } from "@/lib/db/sql-writing/unknown-type";
import type { SqlWritingSpec } from "@/lib/db/sql-writing/types";
import type { DatabaseType } from "@/lib/types";

/**
 * The SQL writing registry is one row per type id, and each row is the object the engine's
 * own module exports at its placement beside the provider (spec 5.3), so a reader of the
 * registry and a typed writer that imports the module directly hold the same rules.
 */
const PLACEMENT: Readonly<Record<DatabaseType, string>> = {
  bigquery: "sql/bigquery/sql-writing",
  cassandra: "sql/cassandra/sql-writing",
  clickhouse: "sql/clickhouse/sql-writing",
  couchbase: "document/couchbase/sql-writing",
  databend: "sql/databend/sql-writing",
  db2: "sql/db2/sql-writing",
  druid: "sql/druid/sql-writing",
  duckdb: "sql/duckdb/sql-writing",
  elasticsearch: "sql/search/elasticsearch-sql-writing",
  etcd: "keyvalue/etcd/sql-writing",
  firestore: "document/firestore/sql-writing",
  influxdb: "timeseries/influxdb/influxdb-sql-writing",
  influxdb3: "timeseries/influxdb/influxdb3-sql-writing",
  kafka: "stream/kafka/sql-writing",
  kubernetes: "platform/kubernetes/sql-writing",
  libredb: "embedded/libredb-sql-writing",
  libsql: "sql/libsql/sql-writing",
  milvus: "vector/milvus/sql-writing",
  modbus: "industrial/modbus/sql-writing",
  mongodb: "document/mongodb/sql-writing",
  mqtt: "keyvalue/mqtt/sql-writing",
  mssql: "sql/mssql-sql-writing",
  mtconnect: "industrial/mtconnect/sql-writing",
  mysql: "sql/mysql-sql-writing",
  neo4j: "graph/neo4j/sql-writing",
  netconf: "network/netconf/sql-writing",
  opcua: "industrial/opcua/sql-writing",
  opensearch: "sql/search/opensearch-sql-writing",
  oracle: "sql/oracle-sql-writing",
  oxia: "keyvalue/oxia/sql-writing",
  postgres: "sql/postgres-sql-writing",
  prometheus: "timeseries/prometheus/sql-writing",
  qdrant: "vector/qdrant/sql-writing",
  rabbitmq: "stream/rabbitmq/sql-writing",
  redis: "keyvalue/redis-sql-writing",
  s3: "objectstore/s3/sql-writing",
  snmp: "network/snmp/sql-writing",
  snowflake: "sql/snowflake/sql-writing",
  spark: "sql/spark/sql-writing",
  sparkplug: "industrial/sparkplug/sql-writing",
  sqlite: "sql/sqlite-sql-writing",
  trino: "sql/trino/sql-writing",
};

const exportName = (type: DatabaseType): string => `${type.toUpperCase()}_SQL_WRITING`;

describe("SQL writing census", () => {
  test("one row per shipped type id", () => {
    expect(Object.keys(SQL_WRITING).sort()).toEqual([...EXTERNAL_DATABASE_TYPES, "libredb"].sort());
    expect(Object.keys(PLACEMENT).sort()).toEqual(Object.keys(SQL_WRITING).sort());
  });

  test("the registry is frozen", () => {
    expect(Object.isFrozen(SQL_WRITING)).toBe(true);
  });

  for (const type of Object.keys(PLACEMENT) as DatabaseType[]) {
    test(`${type}: the row is the module at its placement`, async () => {
      const engineModule = (await import(`@/lib/db/providers/${PLACEMENT[type]}`)) as Record<string, unknown>;
      expect(engineModule[exportName(type)]).toBe(SQL_WRITING[type]);
    });
  }

  test("every row is its own object", () => {
    const rows = Object.values(SQL_WRITING);
    expect(new Set(rows).size).toBe(rows.length);
  });

  test("no connection reads the named no-connection spec", () => {
    expect(sqlWritingFor(undefined)).toBe(NO_CONNECTION_SQL_WRITING);
  });

  // Before the contract every writer tested `dialect ? ... : "standard"`, so the empty string a
  // published component's `databaseType?: string` can carry, and a JS caller's `null`, meant no connection.
  test.each(["", null])("%p reads the named no-connection spec", (type) => {
    expect(sqlWritingFor(type as string | undefined)).toBe(NO_CONNECTION_SQL_WRITING);
  });

  test.each(["constructor", "__proto__", "not-an-engine"])("%s reads the named unknown-type spec", (type) => {
    expect(sqlWritingFor(type)).toBe(UNKNOWN_TYPE_SQL_WRITING);
  });

  test("a member of the union reads its row", () => {
    expect(sqlWritingFor("postgres")).toBe(SQL_WRITING.postgres);
  });

  // Every engine but the two that embed SQLite reads the shared type-name sets, and so do
  // the two named specs, because before the contract a type outside the dialect sets, the
  // empty string and an unknown string all read those sets.
  const NO_DECLARED_KINDS = new Set(["sqlite", "libsql"]);
  const SHARED_SET_ROWS: readonly (readonly [string, SqlWritingSpec])[] = [
    ...Object.entries(SQL_WRITING).filter(([id]) => !NO_DECLARED_KINDS.has(id)),
    ["no connection", NO_CONNECTION_SQL_WRITING],
    ["unknown type", UNKNOWN_TYPE_SQL_WRITING],
  ];

  for (const [name, spec] of SHARED_SET_ROWS) {
    test(`${name}: the inline edit reads the shared type-name sets`, () => {
      expect(spec.inlineEdit.instantTypeNames).toBe(INSTANT_TYPE_NAMES);
      expect(spec.inlineEdit.exactDecimalTypeNames).toBe(EXACT_DECIMAL_TYPE_NAMES);
      expect(spec.inlineEdit.float64TypeNames).toBe(FLOAT64_TYPE_NAMES);
    });
  }

  test.each(["sqlite", "libsql"] as const)(
    "%s: no declaration names an instant or exact decimal, and every key is float64",
    (id) => {
      const inlineEdit = SQL_WRITING[id].inlineEdit;
      expect(inlineEdit.instantTypeNames.size).toBe(0);
      expect(inlineEdit.exactDecimalTypeNames.size).toBe(0);
      expect(inlineEdit.float64TypeNames).toBe("all");
    },
  );

  test("sqlite and libsql each state their own sets", () => {
    expect(SQL_WRITING.sqlite.inlineEdit.instantTypeNames).not.toBe(SQL_WRITING.libsql.inlineEdit.instantTypeNames);
    expect(SQL_WRITING.sqlite.inlineEdit.exactDecimalTypeNames).not.toBe(
      SQL_WRITING.libsql.inlineEdit.exactDecimalTypeNames,
    );
  });

  test("only mssql and oracle bind an edit through their own form", () => {
    const bound = Object.entries(SQL_WRITING)
      .filter(([, spec]) => spec.inlineEdit.boundEdit !== undefined)
      .map(([id]) => id)
      .sort();
    expect(bound).toEqual(["mssql", "oracle"]);
    expect(NO_CONNECTION_SQL_WRITING.inlineEdit.boundEdit).toBeUndefined();
    expect(UNKNOWN_TYPE_SQL_WRITING.inlineEdit.boundEdit).toBeUndefined();
  });
});
