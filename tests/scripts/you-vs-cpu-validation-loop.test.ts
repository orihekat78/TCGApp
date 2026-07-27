import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildResumeInstruction,
  recordBrowserRecovery,
  recordRuntimeFailure,
  readValidationLoopState,
  parseValidationWorklist,
} from "../../scripts/you-vs-cpu-validation-loop";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("YOU-vs-CPU validation loop guard", () => {
  it("resumes the first unfinished row and never skips it", () => {
    const rows = parseValidationWorklist(`row,you_id,cpu_id,viewport,status\n001,d08,d08,desktop,clean\n002,d08,d11,desktop,blocked-ui-restart\n003,d08,green,desktop,queued\n`);

    expect(buildResumeInstruction(rows, 0)).toMatchObject({
      row: "002",
      youId: "d08",
      cpuId: "d11",
      viewport: "desktop",
      setupUrl: "http://localhost:5174/#setup",
      action: "resume-current-row",
    });
  });

  it("reopens a fresh browser from setup after consecutive runtime failures", () => {
    const rows = parseValidationWorklist(`row,you_id,cpu_id,viewport,status\n024,green,mill,desktop,queued\n`);

    expect(buildResumeInstruction(rows, 2)).toMatchObject({
      row: "024",
      action: "open-fresh-browser",
      setupUrl: "http://localhost:5174/#setup",
      recovery: {
        consecutiveRuntimeFailures: 2,
        inspectPublicUiBeforeAction: true,
      },
    });
  });

  it("refuses to resume when every row is clean", () => {
    const rows = parseValidationWorklist(`row,you_id,cpu_id,viewport,status\n001,d08,d08,desktop,clean\n002,d08,d11,desktop,clean-public-rerun-seed-unverifiable\n`);

    expect(() => buildResumeInstruction(rows, 0)).toThrow(
      "No unfinished validation row",
    );
  });

  it("persists consecutive runtime failures for the current row", () => {
    const root = mkdtempSync(resolve(tmpdir(), "conan-validation-loop-"));
    tempPaths.push(root);
    const statePath = resolve(root, "loop-state.json");
    const rows = parseValidationWorklist(`row,you_id,cpu_id,viewport,status\n024,green,mill,desktop,queued\n`);

    expect(recordRuntimeFailure(statePath, rows)).toEqual({
      row: "024",
      consecutiveRuntimeFailures: 1,
    });
    expect(recordRuntimeFailure(statePath, rows)).toEqual({
      row: "024",
      consecutiveRuntimeFailures: 2,
    });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({
      row: "024",
      consecutiveRuntimeFailures: 2,
    });
  });

  it("recovers from a malformed checkpoint without skipping the row", () => {
    const root = mkdtempSync(resolve(tmpdir(), "conan-validation-loop-"));
    tempPaths.push(root);
    const statePath = resolve(root, "loop-state.json");
    writeFileSync(statePath, "not json", "utf8");
    const rows = parseValidationWorklist(`row,you_id,cpu_id,viewport,status\n024,green,mill,desktop,queued\n025,green,white,desktop,queued\n`);

    expect(readValidationLoopState(statePath, rows)).toEqual({
      row: "024",
      consecutiveRuntimeFailures: 0,
    });
  });

  it("clears the failure counter after a fresh browser reaches setup", () => {
    const root = mkdtempSync(resolve(tmpdir(), "conan-validation-loop-"));
    tempPaths.push(root);
    const statePath = resolve(root, "loop-state.json");
    const rows = parseValidationWorklist(`row,you_id,cpu_id,viewport,status\n024,green,mill,desktop,queued\n`);

    recordRuntimeFailure(statePath, rows);
    recordRuntimeFailure(statePath, rows);

    expect(recordBrowserRecovery(statePath, rows)).toEqual({
      row: "024",
      consecutiveRuntimeFailures: 0,
    });
  });
});
