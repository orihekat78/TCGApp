/**
 * AI simulation and replay are headless authorities. They must not inherit
 * the interactive UI player's identity from the caller process.
 */
export function withHeadlessDecisionContext<T>(run: () => T): T {
  const hadHumanSide = Object.prototype.hasOwnProperty.call(
    globalThis,
    '__humanPlayerSide',
  );
  const previousHumanSide = globalThis.__humanPlayerSide;
  globalThis.__humanPlayerSide = null;
  try {
    return run();
  } finally {
    if (hadHumanSide) globalThis.__humanPlayerSide = previousHumanSide;
    else delete globalThis.__humanPlayerSide;
  }
}
