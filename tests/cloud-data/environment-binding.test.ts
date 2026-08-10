import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseDatabaseSentinelRow,
  validateDatabaseSentinel,
  type DeploymentPolicy,
} from "../../src/cloud-data/request-context";

const migration = readFileSync(
  resolve(process.cwd(), "migrations/0001_cloud_data.sql"),
  "utf8",
);
const databases: DatabaseSync[] = [];

function provision(environment: "production" | "preview"): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  db.exec("PRAGMA recursive_triggers = OFF");
  db.exec(migration);
  db.exec(
    readFileSync(
      resolve(process.cwd(), `migrations/environments/${environment}.sql`),
      "utf8",
    ),
  );
  return db;
}

function sentinelFrom(db: DatabaseSync) {
  return parseDatabaseSentinelRow(
    db
      .prepare(
        `SELECT singleton, environment, database_id AS databaseId
       FROM app_meta WHERE singleton = 1`,
      )
      .get(),
  );
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("database-anchored environment sentinel", () => {
  const productionPolicy: DeploymentPolicy = {
    environment: "production",
    host: { kind: "exact", value: "conan-private.pages.dev" },
    audience: "production-audience",
    databaseId: "production-database",
  };

  it("accepts the sentinel read from the matching database", () => {
    const production = provision("production");
    expect(() =>
      validateDatabaseSentinel(productionPolicy, sentinelFrom(production)),
    ).not.toThrow();
  });

  it("rejects a production request bound to the preview database", () => {
    const preview = provision("preview");
    expect(() =>
      validateDatabaseSentinel(productionPolicy, sentinelFrom(preview)),
    ).toThrow("ENVIRONMENT_MISMATCH");
  });

  it("makes the provisioned database identity immutable", () => {
    const production = provision("production");
    expect(() =>
      production
        .prepare(
          "UPDATE app_meta SET environment = 'preview' WHERE singleton = 1",
        )
        .run(),
    ).toThrow("DATABASE_SENTINEL_IMMUTABLE");
    expect(() =>
      production.prepare("DELETE FROM app_meta WHERE singleton = 1").run(),
    ).toThrow("DATABASE_SENTINEL_IMMUTABLE");
    expect(() =>
      production
        .prepare(
          `INSERT OR REPLACE INTO app_meta
          (singleton, environment, database_id, initialized_at)
         VALUES (1, 'preview', 'preview-database', 2)`,
        )
        .run(),
    ).toThrow("DATABASE_SENTINEL_IMMUTABLE");
    expect(sentinelFrom(production)).toEqual({
      environment: "production",
      databaseId: "production-database",
    });
  });

  it("fails closed when a database was not provisioned", () => {
    const empty = new DatabaseSync(":memory:");
    databases.push(empty);
    empty.exec("PRAGMA recursive_triggers = OFF");
    empty.exec(migration);
    expect(() => sentinelFrom(empty)).toThrow("DATABASE_SENTINEL_MISSING");
  });
});
