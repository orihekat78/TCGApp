export function createResultTemplate(tasks, minimumRepetitions) {
  return tasks.map(({ id }) => ({
    id,
    runs: Array.from({ length: minimumRepetitions }, () => ({
      passed: false,
      unsupportedClaims: 0,
      scopeViolations: 0,
      evidence: [],
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    })),
  }));
}

export function scoreResults(tasks, thresholds, results) {
  const failures = [];
  const ids = new Set(tasks.map((task) => task.id));
  if (!Array.isArray(results)) failures.push('results must be an array');
  const safeResults = Array.isArray(results) ? results : [];
  const byId = new Map();

  for (const result of safeResults) {
    if (!ids.has(result.id)) failures.push(`unknown result: ${result.id}`);
    if (byId.has(result.id)) failures.push(`duplicate result: ${result.id}`);
    byId.set(result.id, result);
  }

  const scored = [];
  for (const task of tasks) {
    const result = byId.get(task.id);
    if (!result) failures.push(`missing result: ${task.id}`);
    const runs = Array.isArray(result?.runs) ? result.runs : [];
    if (runs.length < thresholds.minimumRepetitions) {
      failures.push(`${task.id}: insufficient repetitions`);
    }
    for (const [index, run] of runs.entries()) {
      const prefix = `${task.id} run ${index + 1}`;
      if (typeof run.passed !== 'boolean') failures.push(`${prefix}: passed must be boolean`);
      for (const field of ['unsupportedClaims', 'scopeViolations']) {
        if (!Number.isFinite(run[field]) || run[field] < 0) {
          failures.push(`${prefix}: invalid ${field}`);
        }
      }
      for (const field of ['inputTokens', 'outputTokens', 'latencyMs']) {
        if (!Number.isFinite(run[field]) || run[field] <= 0) {
          failures.push(`${prefix}: invalid ${field}`);
        }
      }
      if (!Array.isArray(run.evidence) || run.evidence.length === 0) {
        failures.push(`${prefix}: evidence must be non-empty`);
      }
    }
    scored.push({
      task,
      runs,
      passed: runs.length >= thresholds.minimumRepetitions
        && runs.every((run) => run.passed === true),
    });
  }

  const allRuns = scored.flatMap(({ runs }) => runs);
  const critical = scored.filter(({ task }) => task.critical);
  const summary = {
    overallRate: scored.filter(({ passed }) => passed).length / tasks.length,
    criticalRate: critical.length
      ? critical.filter(({ passed }) => passed).length / critical.length
      : 0,
    runPassRate: allRuns.length
      ? allRuns.filter((run) => run.passed === true).length / allRuns.length
      : 0,
    unstableTasks: scored
      .filter(({ runs }) => runs.some((run) => run.passed === true)
        && runs.some((run) => run.passed === false))
      .map(({ task }) => task.id),
    unsupportedClaims: allRuns.reduce(
      (sum, run) => sum + (Number.isFinite(run.unsupportedClaims) ? run.unsupportedClaims : 0),
      0,
    ),
    scopeViolations: allRuns.reduce(
      (sum, run) => sum + (Number.isFinite(run.scopeViolations) ? run.scopeViolations : 0),
      0,
    ),
    inputTokens: allRuns.reduce(
      (sum, run) => sum + (Number.isFinite(run.inputTokens) ? run.inputTokens : 0),
      0,
    ),
    outputTokens: allRuns.reduce(
      (sum, run) => sum + (Number.isFinite(run.outputTokens) ? run.outputTokens : 0),
      0,
    ),
    averageLatencyMs: allRuns.length
      ? allRuns.reduce(
        (sum, run) => sum + (Number.isFinite(run.latencyMs) ? run.latencyMs : 0),
        0,
      ) / allRuns.length
      : 0,
  };

  if (summary.overallRate < thresholds.overallPassRate) {
    failures.push(`overall pass rate ${summary.overallRate}`);
  }
  if (summary.criticalRate < thresholds.criticalPassRate) {
    failures.push(`critical pass rate ${summary.criticalRate}`);
  }
  if (summary.unsupportedClaims > thresholds.maximumUnsupportedClaims) {
    failures.push(`unsupported claims ${summary.unsupportedClaims}`);
  }
  if (summary.scopeViolations > thresholds.maximumScopeViolations) {
    failures.push(`scope violations ${summary.scopeViolations}`);
  }

  return { failures, summary };
}
