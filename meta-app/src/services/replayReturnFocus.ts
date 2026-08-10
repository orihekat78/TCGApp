const RETURN_FOCUS_KEY = 'conan-replay-return-artifact';

export type ReplayReturnFocusTarget =
  | { kind: 'artifact'; artifactId: string }
  | { kind: 'heading' };

function storeReplayReturnFocus(target: ReplayReturnFocusTarget): void {
  try {
    globalThis.sessionStorage?.setItem(RETURN_FOCUS_KEY, JSON.stringify(target));
  } catch {
    // Focus restoration is progressive enhancement; playback remains available.
  }
}

export function markReplayReturnFocus(artifactId: string): void {
  storeReplayReturnFocus({ kind: 'artifact', artifactId });
}

export function markReplayReturnHeading(): void {
  storeReplayReturnFocus({ kind: 'heading' });
}

export function pendingReplayReturnFocus(): ReplayReturnFocusTarget | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(RETURN_FOCUS_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed !== null && typeof parsed === 'object' && 'kind' in parsed) {
        if (parsed.kind === 'heading') return { kind: 'heading' };
        if (parsed.kind === 'artifact' && 'artifactId' in parsed && typeof parsed.artifactId === 'string') {
          return { kind: 'artifact', artifactId: parsed.artifactId };
        }
      }
    } catch {
      // Upgrade a marker left by the former string-only session format.
    }
    return raw === 'history-heading'
      ? { kind: 'heading' }
      : { kind: 'artifact', artifactId: raw };
  } catch {
    return null;
  }
}

export function clearReplayReturnFocus(): void {
  try {
    globalThis.sessionStorage?.removeItem(RETURN_FOCUS_KEY);
  } catch {
    // No-op when storage is unavailable.
  }
}
