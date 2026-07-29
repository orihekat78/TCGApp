type HumanPlayerSide = 'self' | 'opp' | null;

/**
 * AI simulation and replay are headless authorities. They must not inherit
 * the interactive UI player's identity from the caller process.
 */
export function withHeadlessDecisionContext<T>(run: () => T): T {
  const root = globalThis as { __humanPlayerSide?: HumanPlayerSide };
  const hadHumanSide = Object.prototype.hasOwnProperty.call(root, '__humanPlayerSide');
  const previousHumanSide = root.__humanPlayerSide;
  root.__humanPlayerSide = null;
  try {
    return run();
  } finally {
    if (hadHumanSide) root.__humanPlayerSide = previousHumanSide;
    else delete root.__humanPlayerSide;
  }
}
