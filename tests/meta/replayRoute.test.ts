import { describe, expect, it } from 'vitest';
import {
  buildReplayHash,
  replayArtifactIdFromHash,
  routeFromHash,
} from '../../meta-app/src/router/useHashRoute';
import {
  clearReplayReturnFocus,
  markReplayReturnFocus,
  markReplayReturnHeading,
  pendingReplayReturnFocus,
} from '../../meta-app/src/services/replayReturnFocus';

describe('exact replay hash route', () => {
  it('keeps the replay route reload-safe with one exact artifact identity', () => {
    const hash = buildReplayHash('replay-match-a');
    expect(hash).toBe('#replay/replay-match-a');
    expect(routeFromHash(hash)).toBe('replay');
    expect(replayArtifactIdFromHash(hash)).toBe('replay-match-a');
  });

  it('never falls back from malformed, empty, nested, or non-replay hashes', () => {
    for (const hash of ['#replay', '#replay/', '#replay/a/b', '#history/replay-a', '#replay/%2F']) {
      expect(replayArtifactIdFromHash(hash)).toBeNull();
    }
    expect(() => buildReplayHash('')).toThrow();
    expect(() => buildReplayHash('a/b')).toThrow();
  });
});

describe('replay return focus marker', () => {
  it('distinguishes an artifact ID from the History heading target', () => {
    clearReplayReturnFocus();
    markReplayReturnFocus('history-heading');
    expect(pendingReplayReturnFocus()).toEqual({
      kind: 'artifact',
      artifactId: 'history-heading',
    });

    markReplayReturnHeading();
    expect(pendingReplayReturnFocus()).toEqual({ kind: 'heading' });
    clearReplayReturnFocus();
    expect(pendingReplayReturnFocus()).toBeNull();
  });
});
