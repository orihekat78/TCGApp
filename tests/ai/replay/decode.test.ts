import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { startCausalSession } from '@/engine/log/causal';
import { mutate } from '@/engine/mutate';
import { decodeReplayLog, REPLAY_VALIDATION_ERROR } from '@/ai/replay/decode';
import { buildReplayLogV3 } from '@/ai/replay/state-frame';

function makeV1(): unknown {
  return {
    schemaVersion: 1,
    initialState: createEmptyGameState(),
    moves: [],
    result: { winner: 'self', reason: 'turn-cap', turns: 0 },
  };
}

function makeV3() {
  const sessionId = 'decode-v3';
  const state = createEmptyGameState();
  startCausalSession(state, sessionId);
  mutate.gameResult.set(state, 'self', 'evidence');
  return buildReplayLogV3({
    artifactId: 'decode-v3-artifact',
    sessionId,
    viewerMode: 'solo-self',
    states: [state],
  });
}

describe('decodeReplayLog', () => {
  it('decodes structurally valid legacy V1 and V2 replay files', () => {
    expect(decodeReplayLog(makeV1()).schemaVersion).toBe(1);
    expect(decodeReplayLog({
      ...makeV1() as object,
      schemaVersion: 2,
      nondeterminism: { random: [], now: [] },
    }).schemaVersion).toBe(2);
  });

  it.each([
    null,
    [],
    {},
    { schemaVersion: 4 },
    { ...makeV1() as object, initialState: null },
    { ...makeV1() as object, moves: null },
    { ...makeV1() as object, result: null },
    { ...makeV1() as object, schemaVersion: 2, nondeterminism: { random: [1], now: [] } },
    { schemaVersion: 3 },
  ])('rejects malformed replay input before consumers dereference it: %#', (input) => {
    expect(() => decodeReplayLog(input)).toThrow(REPLAY_VALIDATION_ERROR);
  });

  it('rejects executable values outside the validated V3 state graph', () => {
    const log = makeV3() as ReturnType<typeof makeV3> & { executable?: unknown };
    log.executable = () => 'not-json';

    expect(() => decodeReplayLog(log)).toThrow(REPLAY_VALIDATION_ERROR);
  });
});
