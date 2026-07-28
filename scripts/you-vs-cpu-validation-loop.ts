import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ValidationRow = {
  row: string;
  youId: string;
  cpuId: string;
  viewport: string;
  status: string;
};

export type ResumeInstruction = {
  row: string;
  youId: string;
  cpuId: string;
  viewport: string;
  setupUrl: "http://127.0.0.1:5174/#setup";
  action: "resume-current-row" | "open-fresh-browser";
  recovery: {
    consecutiveRuntimeFailures: number;
    inspectPublicUiBeforeAction: true;
    forbidden: readonly ["#match-direct", "dispatch", "state-injection"];
  };
};

export type ValidationLoopState = {
  row: string;
  consecutiveRuntimeFailures: number;
};

const SETUP_URL = "http://127.0.0.1:5174/#setup" as const;

export function parseValidationWorklist(csv: string): ValidationRow[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const [header, ...entries] = lines;
  if (header !== "row,you_id,cpu_id,viewport,status") {
    throw new Error("Invalid validation worklist header");
  }

  const rows = entries.map((line) => {
    const [row, youId, cpuId, viewport, status, ...extra] = line.split(",");
    if (!row || !youId || !cpuId || !viewport || !status || extra.length > 0) {
      throw new Error(`Invalid validation worklist row: ${line}`);
    }
    return { row, youId, cpuId, viewport, status };
  });
  if (new Set(rows.map((entry) => entry.row)).size !== rows.length) {
    throw new Error("Validation worklist has duplicate row IDs");
  }
  return rows;
}

function isClean(status: string): boolean {
  return status.startsWith("clean");
}

function getCurrentRow(rows: readonly ValidationRow[]): ValidationRow {
  const current = rows.find((entry) => !isClean(entry.status));
  if (!current) throw new Error("No unfinished validation row");
  return current;
}

export function readValidationLoopState(
  statePath: string,
  rows: readonly ValidationRow[],
): ValidationLoopState {
  const current = getCurrentRow(rows);
  if (!existsSync(statePath)) {
    return { row: current.row, consecutiveRuntimeFailures: 0 };
  }
  let value: Partial<ValidationLoopState>;
  try {
    value = JSON.parse(readFileSync(statePath, "utf8")) as Partial<ValidationLoopState>;
  } catch {
    return { row: current.row, consecutiveRuntimeFailures: 0 };
  }
  if (
    value.row !== current.row ||
    !Number.isInteger(value.consecutiveRuntimeFailures) ||
    (value.consecutiveRuntimeFailures ?? -1) < 0
  ) {
    return { row: current.row, consecutiveRuntimeFailures: 0 };
  }
  return value as ValidationLoopState;
}

export function recordRuntimeFailure(
  statePath: string,
  rows: readonly ValidationRow[],
): ValidationLoopState {
  const state = readValidationLoopState(statePath, rows);
  const next = {
    row: state.row,
    consecutiveRuntimeFailures: state.consecutiveRuntimeFailures + 1,
  };
  mkdirSync(resolve(statePath, ".."), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function recordBrowserRecovery(
  statePath: string,
  rows: readonly ValidationRow[],
): ValidationLoopState {
  const current = getCurrentRow(rows);
  const next = { row: current.row, consecutiveRuntimeFailures: 0 };
  mkdirSync(resolve(statePath, ".."), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function buildResumeInstruction(
  rows: readonly ValidationRow[],
  consecutiveRuntimeFailures: number,
): ResumeInstruction {
  if (!Number.isInteger(consecutiveRuntimeFailures) || consecutiveRuntimeFailures < 0) {
    throw new Error("Runtime failure count must be a non-negative integer");
  }
  const current = getCurrentRow(rows);

  return {
    row: current.row,
    youId: current.youId,
    cpuId: current.cpuId,
    viewport: current.viewport,
    setupUrl: SETUP_URL,
    action:
      // A runtime/UI stall is never terminal for a validation row.  Retrying
      // the same tab can preserve a modal or selection dead-end, so recover
      // through the public setup flow on the first failure.
      consecutiveRuntimeFailures >= 1
        ? "open-fresh-browser"
        : "resume-current-row",
    recovery: {
      consecutiveRuntimeFailures,
      inspectPublicUiBeforeAction: true,
      forbidden: ["#match-direct", "dispatch", "state-injection"],
    },
  };
}

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main(): void {
  const worklistPath = resolve(
    readArgument("--worklist") ??
      ".claude/sessions/2026-07-27-you-vs-cpu-human-validation-worklist.csv",
  );
  const rows = parseValidationWorklist(readFileSync(worklistPath, "utf8"));
  const statePath = resolve(
    readArgument("--state") ??
      ".claude/sessions/2026-07-27-you-vs-cpu-human-validation-loop-state.json",
  );
  const failures = readArgument("--runtime-failures");
  const state = process.argv.includes("--record-runtime-failure")
    ? recordRuntimeFailure(statePath, rows)
    : process.argv.includes("--record-browser-recovery")
      ? recordBrowserRecovery(statePath, rows)
      : readValidationLoopState(statePath, rows);
  const consecutiveRuntimeFailures = failures === undefined
    ? state.consecutiveRuntimeFailures
    : Number(failures);
  console.log(
    JSON.stringify(
      buildResumeInstruction(rows, consecutiveRuntimeFailures),
      null,
      2,
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
