import { DAILY_RATE_LIMITS } from "./rate-limit";

export type DailyUsageCounters = {
  workersRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
};

export type SyncEnvironmentUsage = DailyUsageCounters & {
  databaseBytes: number;
};

export type UsageBudgetInput = {
  personalSync: {
    production: SyncEnvironmentUsage;
    preview: SyncEnvironmentUsage;
  };
  account: DailyUsageCounters & {
    d1StorageBytes: number;
    largestD1DatabaseBytes: number;
  };
};

export type UsageBudgetStatus =
  | "normal"
  | "headroom-exceeded"
  | "warning"
  | "freeze"
  | "local-only";

export const PERSONAL_SYNC_STORAGE_BUDGET_BYTES = 50 * 1024 * 1024;

export const FREE_TIER_LIMITS = {
  workersRequests: 100_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
  d1AccountStorageBytes: 5 * 1024 * 1024 * 1024,
  d1DatabaseBytes: 500 * 1024 * 1024,
} as const;

export const SYNC_QUOTA_PROOF = {
  productionUsers: 12,
  previewUsers: 1,
  safetyFactor: 2,
  routeEnvelope: {
    read: { rowsRead: 1_250, rowsWritten: 2 },
    write: { rowsRead: 550, rowsWritten: 12 },
    match: { rowsRead: 40, rowsWritten: 16 },
    matchDayWithMaxCleanup: { rowsRead: 2_000, rowsWritten: 760 },
    firstBootstrap: { rowsRead: 20, rowsWritten: 8 },
  },
} as const;

export function estimateWorstCaseDailySyncUsage(): DailyUsageCounters {
  const users =
    SYNC_QUOTA_PROOF.productionUsers + SYNC_QUOTA_PROOF.previewUsers;
  const envelope = SYNC_QUOTA_PROOF.routeEnvelope;
  const perUserRequests =
    DAILY_RATE_LIMITS.read +
    DAILY_RATE_LIMITS.write +
    DAILY_RATE_LIMITS.match;
  const perUserRowsRead =
    DAILY_RATE_LIMITS.read * envelope.read.rowsRead +
    DAILY_RATE_LIMITS.write * envelope.write.rowsRead +
    envelope.matchDayWithMaxCleanup.rowsRead;
  const firstBootstrapExtraWrites = Math.max(
    0,
    envelope.firstBootstrap.rowsWritten - envelope.read.rowsWritten,
  );
  const perUserRowsWritten =
    DAILY_RATE_LIMITS.read * envelope.read.rowsWritten +
    DAILY_RATE_LIMITS.write * envelope.write.rowsWritten +
    envelope.matchDayWithMaxCleanup.rowsWritten +
    firstBootstrapExtraWrites;

  return {
    workersRequests: users * perUserRequests,
    d1RowsRead: users * perUserRowsRead,
    d1RowsWritten: users * perUserRowsWritten,
  };
}

const severity: Record<UsageBudgetStatus, number> = {
  normal: 0,
  "headroom-exceeded": 1,
  warning: 2,
  freeze: 3,
  "local-only": 4,
};

function statusForRatio(ratio: number): UsageBudgetStatus {
  if (ratio >= 0.9) return "local-only";
  if (ratio >= 0.75) return "freeze";
  if (ratio >= 0.5) return "warning";
  if (ratio > 0.25) return "headroom-exceeded";
  return "normal";
}

function maxStatus(
  left: UsageBudgetStatus,
  right: UsageBudgetStatus,
): UsageBudgetStatus {
  return severity[left] >= severity[right] ? left : right;
}

function valuesAreValid(input: UsageBudgetInput): boolean {
  const values = [
    ...Object.values(input.personalSync.production),
    ...Object.values(input.personalSync.preview),
    ...Object.values(input.account),
  ];
  return values.every((value) => Number.isFinite(value) && value >= 0);
}

export function assessUsageBudget(input: UsageBudgetInput): {
  status: UsageBudgetStatus;
  reasons: string[];
  highestPersonalDailyRatio: number;
  highestAccountRatio: number;
} {
  if (!valuesAreValid(input)) throw new Error("USAGE_INVALID");

  const production = input.personalSync.production;
  const preview = input.personalSync.preview;
  const personal = {
    workersRequests: production.workersRequests + preview.workersRequests,
    d1RowsRead: production.d1RowsRead + preview.d1RowsRead,
    d1RowsWritten: production.d1RowsWritten + preview.d1RowsWritten,
    databaseBytes: production.databaseBytes + preview.databaseBytes,
  };
  if (
    personal.workersRequests > input.account.workersRequests ||
    personal.d1RowsRead > input.account.d1RowsRead ||
    personal.d1RowsWritten > input.account.d1RowsWritten ||
    personal.databaseBytes > input.account.d1StorageBytes ||
    Math.max(production.databaseBytes, preview.databaseBytes) >
      input.account.largestD1DatabaseBytes
  ) {
    throw new Error("USAGE_SCOPE_INVALID");
  }

  const personalRatios = {
    PERSONAL_SYNC_WORKERS_REQUESTS:
      personal.workersRequests / FREE_TIER_LIMITS.workersRequests,
    PERSONAL_SYNC_D1_ROWS_READ:
      personal.d1RowsRead / FREE_TIER_LIMITS.d1RowsRead,
    PERSONAL_SYNC_D1_ROWS_WRITTEN:
      personal.d1RowsWritten / FREE_TIER_LIMITS.d1RowsWritten,
  } as const;
  const accountRatios = {
    ACCOUNT_WORKERS_REQUESTS:
      input.account.workersRequests / FREE_TIER_LIMITS.workersRequests,
    ACCOUNT_D1_ROWS_READ:
      input.account.d1RowsRead / FREE_TIER_LIMITS.d1RowsRead,
    ACCOUNT_D1_ROWS_WRITTEN:
      input.account.d1RowsWritten / FREE_TIER_LIMITS.d1RowsWritten,
    ACCOUNT_D1_STORAGE:
      input.account.d1StorageBytes / FREE_TIER_LIMITS.d1AccountStorageBytes,
    ACCOUNT_D1_DATABASE_SIZE:
      input.account.largestD1DatabaseBytes / FREE_TIER_LIMITS.d1DatabaseBytes,
  } as const;

  const highestPersonalDailyRatio = Math.max(...Object.values(personalRatios));
  const highestAccountRatio = Math.max(...Object.values(accountRatios));
  let status = maxStatus(
    statusForRatio(highestPersonalDailyRatio),
    statusForRatio(highestAccountRatio),
  );
  const reasons = [
    ...Object.entries(personalRatios),
    ...Object.entries(accountRatios),
  ]
    .filter(([, ratio]) => ratio > 0.25)
    .map(([reason]) => reason);

  if (personal.databaseBytes >= PERSONAL_SYNC_STORAGE_BUDGET_BYTES) {
    reasons.push("PERSONAL_DATABASE_STORAGE_BUDGET");
    status = maxStatus(status, "freeze");
  }

  return { status, reasons, highestPersonalDailyRatio, highestAccountRatio };
}
