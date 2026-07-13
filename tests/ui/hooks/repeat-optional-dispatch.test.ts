import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { run as runEffect } from '@/engine/effect/resolver';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import type { Effect, EffectCtx } from '@/engine/types';

const effect: Effect = {
  kind: 'sequence',
  steps: [
    { kind: 'repeatOptional', max: 3, body: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ],
};

function reset(): void {
  useGameStateStore.setState({ gameState: null, pendingEffectRepeatOptional: null });
  (globalThis as { __pendingEffectRepeatOptionalSide?: unknown; __pendingEffectRepeatOptionalResume?: unknown }).__pendingEffectRepeatOptionalSide = null;
  (globalThis as { __pendingEffectRepeatOptionalSide?: unknown; __pendingEffectRepeatOptionalResume?: unknown }).__pendingEffectRepeatOptionalResume = null;
  (globalThis as { __humanPlayerSide?: 'self' | null }).__humanPlayerSide = 'self';
}

function surface(): void {
  let state = createEmptyGameState();
  state.players.self.deck = ['draw-a', 'draw-b', 'draw-c', 'draw-d'];
  const ctx: EffectCtx = { source: { player: 'self', cardId: 'T_REPEAT', abilityId: 'a1', area: 'hand' }, bindings: {} };
  state = produce(state, (draft) => runEffect(draft, effect, ctx));
  useGameStateStore.getState().setGameState(state);
  surfacePendingSideChannels();
}

describe('repeatOptional dispatch bridge', () => {
  beforeEach(reset);

  it('take: pendingを消し、body後に次roundをsurfaceする', () => {
    surface();
    expect(useGameStateStore.getState().pendingEffectRepeatOptional).toMatchObject({ player: 'self', remaining: 3 });

    expect(dispatchEngineAction({ type: 'repeatOptionalResolve', run: true })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toEqual(['draw-a']);
    expect(useGameStateStore.getState().pendingEffectRepeatOptional).toMatchObject({ remaining: 2 });
  });

  it('decline: outer continuationだけを再開する', () => {
    surface();
    expect(dispatchEngineAction({ type: 'repeatOptionalResolve', run: false })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectRepeatOptional).toBeNull();
    expect(useGameStateStore.getState().gameState!.players.self.hand).toEqual(['draw-a']);
  });
});
