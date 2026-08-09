/**
 * AI simulation and replay are headless authorities. They must not inherit
 * the interactive UI player's identity from the caller process.
 */
export function withHeadlessDecisionContext<T>(run: () => T): T {
  const previousHumanSide = Object.getOwnPropertyDescriptor(
    globalThis,
    '__humanPlayerSide',
  );
  Object.defineProperty(globalThis, '__humanPlayerSide', {
    configurable: true,
    enumerable: true,
    value: null,
    writable: true,
  });
  try {
    return run();
  } finally {
    if (previousHumanSide) {
      Object.defineProperty(globalThis, '__humanPlayerSide', previousHumanSide);
    }
    else delete globalThis.__humanPlayerSide;
  }
}
