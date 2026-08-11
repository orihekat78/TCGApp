import { describe, expect, it } from "vitest";
import {
  FREE_TIER_LIMITS,
  PERSONAL_SYNC_STORAGE_BUDGET_BYTES,
  SYNC_QUOTA_PROOF,
  assessUsageBudget,
  estimateWorstCaseDailySyncUsage,
  type UsageBudgetInput,
} from "../../src/cloud-data/usage-budget";
import { DAILY_RATE_LIMITS } from "../../src/cloud-data/rate-limit";
import { CLOUD_DATA_LIMITS } from "../../src/cloud-data/repository";
import { MATCH_RETENTION_MS } from "../../src/cloud-data/retention";

const zeroEnvironment = {
  workersRequests: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  databaseBytes: 0,
};

function usageInput(): UsageBudgetInput {
  return {
    personalSync: {
      production: { ...zeroEnvironment },
      preview: { ...zeroEnvironment },
    },
    account: {
      workersRequests: 0,
      d1RowsRead: 0,
      d1RowsWritten: 0,
      d1StorageBytes: 0,
      largestD1DatabaseBytes: 0,
    },
  };
}

describe("PvP headroom budget", () => {
  it("keeps the rolling retention window below the per-owner match cap", () => {
    const fixedDayMs = 24 * 60 * 60 * 1_000;
    const maximumUtcDaysTouched =
      Math.ceil(MATCH_RETENTION_MS / fixedDayMs) + 1;

    expect(DAILY_RATE_LIMITS.match * maximumUtcDaysTouched).toBeLessThanOrEqual(
      CLOUD_DATA_LIMITS.matches,
    );
  });

  it("keeps every modeled quota below one quarter with 2x safety", () => {
    const estimated = estimateWorstCaseDailySyncUsage();
    const safety = SYNC_QUOTA_PROOF.safetyFactor;

    expect(estimated.workersRequests * safety).toBeLessThanOrEqual(
      FREE_TIER_LIMITS.workersRequests * 0.25,
    );
    expect(estimated.d1RowsRead * safety).toBeLessThanOrEqual(
      FREE_TIER_LIMITS.d1RowsRead * 0.25,
    );
    expect(estimated.d1RowsWritten * safety).toBeLessThanOrEqual(
      FREE_TIER_LIMITS.d1RowsWritten * 0.25,
    );
    expect(PERSONAL_SYNC_STORAGE_BUDGET_BYTES * safety).toBeLessThanOrEqual(
      FREE_TIER_LIMITS.d1DatabaseBytes * 0.25,
    );
    expect(PERSONAL_SYNC_STORAGE_BUDGET_BYTES * safety).toBeLessThanOrEqual(
      FREE_TIER_LIMITS.d1AccountStorageBytes * 0.25,
    );
  });

  it("keeps worst-case allowed sync reads below one quarter with 2x safety", () => {
    const users = 12;
    const fixedRowsPerRequest = 20;
    const bootstrapRows =
      CLOUD_DATA_LIMITS.decks +
      CLOUD_DATA_LIMITS.tombstones +
      1 +
      fixedRowsPerRequest;
    const worstMutationRows =
      CLOUD_DATA_LIMITS.tombstones + fixedRowsPerRequest;
    const oneTimeExpiryCleanupRows = CLOUD_DATA_LIMITS.matches;
    const estimatedRowsRead =
      users *
      (DAILY_RATE_LIMITS.read * bootstrapRows +
        DAILY_RATE_LIMITS.write * worstMutationRows +
        DAILY_RATE_LIMITS.match * fixedRowsPerRequest +
        oneTimeExpiryCleanupRows);

    expect(estimatedRowsRead * 2).toBeLessThanOrEqual(
      FREE_TIER_LIMITS.d1RowsRead * 0.25,
    );
  });

  it("keeps combined production and preview sync at one quarter of daily quotas", () => {
    const input = usageInput();
    input.personalSync.production = {
      workersRequests: 20_000,
      d1RowsRead: 1_000_000,
      d1RowsWritten: 20_000,
      databaseBytes: 10 * 1024 * 1024,
    };
    input.personalSync.preview = {
      workersRequests: 5_000,
      d1RowsRead: 250_000,
      d1RowsWritten: 5_000,
      databaseBytes: 2 * 1024 * 1024,
    };
    Object.assign(input.account, {
      workersRequests: 25_000,
      d1RowsRead: 1_250_000,
      d1RowsWritten: 25_000,
      d1StorageBytes: 12 * 1024 * 1024,
      largestD1DatabaseBytes: 10 * 1024 * 1024,
    });

    expect(assessUsageBudget(input).status).toBe("normal");
  });

  it("reports when preview pushes personal sync into reserved PvP headroom", () => {
    const input = usageInput();
    input.personalSync.production.workersRequests = 25_000;
    input.personalSync.preview.workersRequests = 1;
    input.account.workersRequests = 25_001;

    const result = assessUsageBudget(input);
    expect(result.status).toBe("headroom-exceeded");
    expect(result.reasons).toContain("PERSONAL_SYNC_WORKERS_REQUESTS");
  });

  it.each([
    [50_000, "warning"],
    [75_000, "freeze"],
    [90_000, "local-only"],
  ] as const)(
    "maps account-wide Workers usage %s to %s",
    (workersRequests, status) => {
      const input = usageInput();
      input.account.workersRequests = workersRequests;
      expect(assessUsageBudget(input).status).toBe(status);
    },
  );

  it("freezes scope expansion at the internal personal-sync storage cap", () => {
    const input = usageInput();
    input.personalSync.production.databaseBytes =
      PERSONAL_SYNC_STORAGE_BUDGET_BYTES * 0.8;
    input.personalSync.preview.databaseBytes =
      PERSONAL_SYNC_STORAGE_BUDGET_BYTES * 0.2;
    input.account.d1StorageBytes = PERSONAL_SYNC_STORAGE_BUDGET_BYTES;
    input.account.largestD1DatabaseBytes =
      PERSONAL_SYNC_STORAGE_BUDGET_BYTES * 0.8;

    const result = assessUsageBudget(input);
    expect(result.status).toBe("freeze");
    expect(result.reasons).toContain("PERSONAL_DATABASE_STORAGE_BUDGET");
  });

  it("uses account-wide D1 storage and per-database size as quota signals", () => {
    const accountStorage = usageInput();
    accountStorage.account.d1StorageBytes = 2.5 * 1024 * 1024 * 1024;
    expect(assessUsageBudget(accountStorage).status).toBe("warning");

    const databaseSize = usageInput();
    databaseSize.account.d1StorageBytes = 450 * 1024 * 1024;
    databaseSize.account.largestD1DatabaseBytes = 450 * 1024 * 1024;
    expect(assessUsageBudget(databaseSize).status).toBe("local-only");
  });

  it("rejects counters that claim personal use exceeds the account total", () => {
    const input = usageInput();
    input.personalSync.preview.d1RowsWritten = 2;
    input.account.d1RowsWritten = 1;
    expect(() => assessUsageBudget(input)).toThrow("USAGE_SCOPE_INVALID");
  });
});
