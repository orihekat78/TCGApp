import { afterEach, describe, expect, it, vi } from 'vitest';
import { run } from '@/engine/effect/resolver';
import {
  applyChoiceAndContinuation,
  applyPickAndContinuation,
  applyRpsAndContinuation,
  applySetCardChoiceAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _clearPendingRpsSide,
  _drainPendingEffectChoiceSide,
  _drainPendingEffectPickSide,
  _drainPendingRpsSide,
  _drainPendingSetCardChoiceSide,
  _takePendingSetCardChoiceResume,
} from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import type { Effect, EffectCtx } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

function ctx(): EffectCtx {
  return { source: { player: 'self', uid: 'source', cardId: 'SOURCE', abilityId: 'a1', area: 'scene' }, bindings: {} };
}

afterEach(() => {
  _clearPendingEffectChoiceSide();
  _clearPendingEffectPickQueue();
  _clearPendingRpsSide();
  _drainPendingSetCardChoiceSide();
  _takePendingSetCardChoiceResume();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  vi.restoreAllMocks();
});

describe('parallel human decision boundaries', () => {
  it('defers its tail until a runtime choice is resolved', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['OPTION', 'TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const choice: Effect = {
      kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'parallel', steps: [] },
      ],
    };

    run(state, { kind: 'parallel', steps: [choice, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }] }, ctx());

    expect(state.players.self.hand).toEqual([]);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
    expect(state.players.self.hand).toEqual(['OPTION', 'TAIL']);
  });

  it('defers its tail until a human atom pick is resolved', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['PICK'];
    state.players.self.deck = ['TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    run(state, {
      kind: 'parallel',
      steps: [
        { kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, ctx());

    expect(state.players.self.hand).toEqual(['PICK']);
    const pending = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, pending, pending.candidates[0]!.uid);
    expect(state.players.self.hand).toEqual(['TAIL']);
  });

  it('defers its tail until a human RPS decision is resolved', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    vi.spyOn(Math, 'random').mockReturnValue(0);

    run(state, {
      kind: 'parallel',
      steps: [
        { kind: 'rps', win: { kind: 'parallel', steps: [] }, lose: { kind: 'parallel', steps: [] } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, ctx());

    const pending = _drainPendingRpsSide();
    expect(state.players.self.hand).toEqual([]);
    const winningHand = pending!.aiHand === 'rock' ? 'paper' : pending!.aiHand === 'paper' ? 'scissors' : 'rock';
    applyRpsAndContinuation(state, pending!, winningHand);
    expect(state.players.self.hand).toEqual(['TAIL']);
  });

  it('rejects an invalid RPS hand without consuming the retryable decision', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    vi.spyOn(Math, 'random').mockReturnValue(0);

    run(state, {
      kind: 'sequence',
      steps: [
        { kind: 'rps', win: { kind: 'parallel', steps: [] }, lose: { kind: 'parallel', steps: [] } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, ctx());

    const pending = _drainPendingRpsSide()!;
    expect(() => applyRpsAndContinuation(state, pending, 'lizard' as never))
      .toThrow(/invalid RPS hand/);
    expect(state.players.self.hand).toEqual([]);

    const winningHand = pending.aiHand === 'rock' ? 'paper' : pending.aiHand === 'paper' ? 'scissors' : 'rock';
    applyRpsAndContinuation(state, pending, winningHand);
    expect(state.players.self.hand).toEqual(['TAIL']);
  });

  it('defers an outer tail when a nested sequence pauses for a human choice', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['OPTION', 'TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const choice: Effect = {
      kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'parallel', steps: [] },
      ],
    };

    run(state, {
      kind: 'parallel',
      steps: [
        { kind: 'sequence', steps: [choice] },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, ctx());

    expect(state.players.self.hand).toEqual([]);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
    expect(state.players.self.hand).toEqual(['OPTION', 'TAIL']);
  });

  it('defers a sequence tail when its nested parallel pauses for a human choice', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['OPTION', 'TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const choice: Effect = {
      kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'parallel', steps: [] },
      ],
    };

    run(state, {
      kind: 'sequence',
      steps: [
        { kind: 'parallel', steps: [choice] },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, ctx());

    expect(state.players.self.hand).toEqual([]);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
    expect(state.players.self.hand).toEqual(['OPTION', 'TAIL']);
  });

  it('keeps an outer tail paused when a resumed choice surfaces a nested choice', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['INNER', 'OUTER'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    run(state, {
      kind: 'sequence',
      steps: [
        {
          kind: 'choice', chooser: 'self', options: [
            {
              kind: 'choice', chooser: 'self', options: [
                { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
                { kind: 'parallel', steps: [] },
              ],
            },
            { kind: 'parallel', steps: [] },
          ],
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, ctx());

    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);

    expect(state.players.self.hand).toEqual([]);
    const nested = _drainPendingEffectChoiceSide();
    expect(nested).not.toBeNull();

    applyChoiceAndContinuation(state, nested!, 0);
    expect(state.players.self.hand).toEqual(['INNER', 'OUTER']);
  });

  it('keeps an outer tail paused when a resumed choice surfaces a nested RPS decision', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const choice: Effect = {
      kind: 'choice', chooser: 'self', options: [
        { kind: 'parallel', steps: [] },
        { kind: 'parallel', steps: [] },
      ],
    };

    run(state, {
      kind: 'sequence',
      steps: [
        {
          kind: 'parallel',
          steps: [
            choice,
            { kind: 'rps', win: { kind: 'parallel', steps: [] }, lose: { kind: 'parallel', steps: [] } },
          ],
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, ctx());

    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);

    expect(state.players.self.hand).toEqual([]);
    const pending = _drainPendingRpsSide();
    const winningHand = pending!.aiHand === 'rock' ? 'paper' : pending!.aiHand === 'paper' ? 'scissors' : 'rock';
    applyRpsAndContinuation(state, pending!, winningHand);
    expect(state.players.self.hand).toEqual(['TAIL']);
  });

  it('keeps an outer tail paused when a resumed choice surfaces a nested set-card decision', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['INNER', 'OUTER'];
    state.players.self.scene = [sceneChar('HOST', 'host', {
      setCards: [{ cardId: 'SECRET', faceUp: false, instanceId: 'set:hidden' }],
    })];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    run(state, {
      kind: 'sequence',
      steps: [
        {
          kind: 'choice',
          chooser: 'self',
          options: [
            {
              kind: 'parallel',
              steps: [
                {
                  kind: 'moveSetCard',
                  hostUid: 'host',
                  face: 'down',
                  destination: { area: 'hand' },
                },
                { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
              ],
            },
            { kind: 'parallel', steps: [] },
          ],
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    }, ctx());

    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);

    expect(state.players.self.hand).toEqual([]);
    const pendingSetCard = _drainPendingSetCardChoiceSide();
    expect(pendingSetCard?.entries).toEqual([
      { instanceId: 'set:hidden', ordinal: 1, hidden: true },
    ]);

    expect(applySetCardChoiceAndContinuation(state, pendingSetCard!, 'set:hidden')).toBe(true);
    expect(state.players.self.hand).toEqual(['SECRET', 'INNER', 'OUTER']);
  });

  it('snapshots a draft-owned choice continuation before resolving it', () => {
    const base = createEmptyGameState();
    base.players.self.deck = ['OPTION', 'TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const choice: Effect = {
      kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'parallel', steps: [] },
      ],
    };
    const paused = produce(base, (draft) => {
      run(draft, { kind: 'parallel', steps: [choice, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }] }, {
        ...ctx(),
        bindings: { $draft: draft.players.self as unknown as EffectCtx['bindings'][string] },
      });
    });
    const state = structuredClone(paused);

    expect(() => applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0)).not.toThrow();
    expect(state.players.self.hand).toEqual(['OPTION', 'TAIL']);
  });
});
