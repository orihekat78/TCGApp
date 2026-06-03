// DIAGNOSTIC (temporary) — D11020 a1 short-form sceneRemove CPU resolution audit
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { produce } from 'immer';
import { registerAll } from '@/cards/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { D11020 } from '@/cards/ct-d11/D11020';
import type { EffectCtx, GameState, SceneCharacter } from '@/engine/types';

const VICTIM = 'D11013'; // level 2, ap 1000 character

function mkChar(cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return {
    cardId, uid, state, isNamed: false, enterOrder: 0,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

beforeAll(() => registerAll());
afterEach(() => { _clearPendingEffectPickQueue(); _setHumanPlayerSide(null); });

describe('DIAG D11020 a1 — CPU (non-human) full-flow resolution', () => {
  it('REAL FLOW: resolveEffectPicks(AI)->runEffect removes a sleeping lvl<=7 enemy char', () => {
    _setHumanPlayerSide(null); // all CPU (matches claim harness humanSide=null)
    const a1 = D11020.abilities.find(a => a.id === 'a1')!;

    const base = createEmptyGameState();
    // D11020 used by opp (CPU). step1 removes a sleeping lvl<=7 char on EITHER side.
    base.players.self.scene.push(mkChar(VICTIM, 'self-victim', 'sleep'));

    const ctx: EffectCtx = {
      source: { player: 'opp', area: 'hand', cardId: 'D11020', uid: 'opp-d11020' },
      bindings: {},
    };

    // ---- This mirrors triggered.ts EXACTLY for a CPU-owned effect ----
    const aiPolicy = new HeuristicPolicy();
    const resolved = resolveEffectPicks(base, a1.effect!, ctx, {
      chooseAtomTarget: aiPolicy.chooseAtomTarget?.bind(aiPolicy),
      byPlayer: 'opp',
      humanChooser: false,
      source: { cardId: 'D11020', abilityId: 'a1' },
    });

    const queueAfterWalk = _peekPendingEffectPickQueueLength();

    const next = produce(base, (draft: GameState) => {
      runEffect(draft, resolved, ctx);
    });

    const selfSceneAfter = next.players.self.scene.length;
    const queueAfterRun = _peekPendingEffectPickQueueLength();

    // eslint-disable-next-line no-console
    console.log('DIAG-D11020-REALFLOW', { queueAfterWalk, selfSceneAfter, queueAfterRun });

    expect(queueAfterWalk).toBe(0);      // AI walk resolves pick inline, NOT queued
    expect(selfSceneAfter).toBe(0);      // enemy char actually removed
  });

  it('RAW (claim harness style): runEffect on raw effect WITHOUT resolveEffectPicks', () => {
    _setHumanPlayerSide(null);
    const a1 = D11020.abilities.find(a => a.id === 'a1')!;
    const base = createEmptyGameState();
    base.players.self.scene.push(mkChar(VICTIM, 'self-victim', 'sleep'));
    const ctx: EffectCtx = {
      source: { player: 'opp', area: 'hand', cardId: 'D11020', uid: 'opp-d11020' },
      bindings: {},
    };
    const next = produce(base, (draft: GameState) => {
      runEffect(draft, a1.effect!, ctx); // RAW — skips resolveEffectPicks
    });
    const selfSceneAfter = next.players.self.scene.length;
    const queueAfterRun = _peekPendingEffectPickQueueLength();
    // eslint-disable-next-line no-console
    console.log('DIAG-D11020-RAW', { selfSceneAfter, queueAfterRun });
    // documents the WRONG harness: raw path pushes to queue (humanChooser:true forced)
  });
});
