export type ReplayNondeterminism = {
  random: number[];
  now: number[];
};

export type NondeterminismCaptureScope = {
  withoutCapture<T>(run: () => T): T;
};

let active = false;

function enter(): void {
  if (active) throw new Error('nested replay nondeterminism capture is not supported');
  active = true;
}

function leave(): void {
  active = false;
}

/** Capture every ambient random/clock read made by one synchronous engine run. */
export function captureNondeterminism<T>(run: (scope: NondeterminismCaptureScope) => T): {
  value: T;
  trace: ReplayNondeterminism;
} {
  enter();
  const originalRandom = Math.random;
  const originalNow = Date.now;
  const trace: ReplayNondeterminism = { random: [], now: [] };
  let suppressionDepth = 0;
  const scope: NondeterminismCaptureScope = {
    withoutCapture(runWithoutCapture) {
      suppressionDepth += 1;
      try {
        return runWithoutCapture();
      } finally {
        suppressionDepth -= 1;
      }
    },
  };
  Math.random = () => {
    const value = originalRandom();
    if (suppressionDepth === 0) trace.random.push(value);
    return value;
  };
  Date.now = () => {
    const value = originalNow();
    if (suppressionDepth === 0) trace.now.push(value);
    return value;
  };
  try {
    return { value: run(scope), trace };
  } finally {
    Math.random = originalRandom;
    Date.now = originalNow;
    leave();
  }
}

/** Replay a captured trace. Prefix playback may permit a deterministic unused tail. */
export function replayNondeterminism<T>(
  trace: ReplayNondeterminism,
  run: () => T,
  opts: { requireAll?: boolean } = {},
): T {
  enter();
  const originalRandom = Math.random;
  const originalNow = Date.now;
  let randomIndex = 0;
  let nowIndex = 0;
  Math.random = () => {
    if (randomIndex >= trace.random.length) {
      throw new Error(`replay random trace exhausted at read ${randomIndex + 1}`);
    }
    const value = trace.random[randomIndex++];
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error(`invalid replay random value at index ${randomIndex - 1}`);
    }
    return value;
  };
  Date.now = () => {
    if (nowIndex >= trace.now.length) {
      throw new Error(`replay clock trace exhausted at read ${nowIndex + 1}`);
    }
    const value = trace.now[nowIndex++];
    if (!Number.isFinite(value)) {
      throw new Error(`invalid replay clock value at index ${nowIndex - 1}`);
    }
    return value;
  };
  try {
    const value = run();
    if (opts.requireAll !== false) {
      if (randomIndex !== trace.random.length) {
        throw new Error(`replay random trace has ${trace.random.length - randomIndex} unused values`);
      }
      if (nowIndex !== trace.now.length) {
        throw new Error(`replay clock trace has ${trace.now.length - nowIndex} unused values`);
      }
    }
    return value;
  } finally {
    Math.random = originalRandom;
    Date.now = originalNow;
    leave();
  }
}
