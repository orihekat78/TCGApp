export const MATCH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type RetentionTable =
  | "matches"
  | "idempotency_keys"
  | "deletion_challenges";

export type RetentionCleanupStatement = {
  table: RetentionTable;
  sql: string;
  bindings: [number, number];
};

const retentionTables: readonly RetentionTable[] = [
  "matches",
  "idempotency_keys",
  "deletion_challenges",
];

export function createRetentionCleanupStatements(
  now: number,
  batchSize: number,
): RetentionCleanupStatement[] {
  if (!Number.isSafeInteger(now) || now < 0)
    throw new Error("RETENTION_NOW_INVALID");
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1_000) {
    throw new Error("RETENTION_BATCH_INVALID");
  }

  return retentionTables.map((table) => ({
    table,
    sql: `DELETE FROM ${table}
      WHERE rowid IN (
        SELECT rowid FROM ${table}
        WHERE expires_at <= ?
        ORDER BY expires_at, rowid
        LIMIT ?
      )`,
    bindings: [now, batchSize],
  }));
}
