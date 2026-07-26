import { beforeEach, describe, expect, it } from 'vitest';
import { B10018, B10018P } from '@/cards/ct-p10/B10018';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { evalCond } from '@/engine/cond/eval';
import { run as runEffect } from '@/engine/effect/resolver';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, resetPendingEffectSession } from '@/engine/effect/pending-state';
import { _resetRegistry as resetDefRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/target/candidates';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, EffectCtx } from '@/engine/types';

const soccer: CardDef = { id: 'SOCCER', no: 'T/SOCCER', kind: 'character', names: ['SOCCER'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: ['サッカー'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const gadget: CardDef = { id: 'GADGET', no: 'T/GADGET', kind: 'event', names: ['GADGET'], colors: [], traits: ['ガジェット'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

function ctx(abilityId: string): EffectCtx {
  return { source: { player: 'self', uid: 'host', cardId: 'B10018', abilityId, area: 'hand' }, bindings: {} };
}

beforeEach(() => {
  resetDefRegistry(); [B10018, B10018P, soccer, gadget].forEach(register);
  _clearPendingEffectPickQueue(); resetPendingEffectSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B10018 どこでもボール射出ベルト', () => {
  it('uses the standard event path to set itself on one soccer host for AI and human', () => {
    const a1 = B10018.abilities.find((ability) => ability.id === 'a1')!;
    const ai = createEmptyGameState();
    ai.players.self.remove = ['B10018'];
    ai.players.self.scene = [sceneChar('SOCCER', 'host')];
    runEffect(ai, a1.effect!, ctx('a1'));
    const aiPending = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(ai, aiPending, 'host');
    expect(ai.players.self.scene[0]!.setCards).toMatchObject([{ cardId: 'B10018', faceUp: true }]);

    const human = createEmptyGameState();
    human.players.self.remove = ['B10018'];
    human.players.self.scene = [sceneChar('SOCCER', 'host')];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(human, a1.effect!, ctx('a1'));
    const pending = _drainPendingEffectPickSide()!;
    expect(pending.candidates.map((candidate) => candidate.uid)).toEqual(['host']);
  });

  it('treats a face-up gadget on a host as present while a face-down gadget remains opaque', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [
      sceneChar('GADGET', 'scene-gadget'),
      sceneChar('SOCCER', 'host', { setCards: [{ cardId: 'GADGET', faceUp: true, instanceId: 'up' }] }),
      sceneChar('SOCCER', 'hidden', { setCards: [{ cardId: 'GADGET', faceUp: false, instanceId: 'down' }] }),
    ];
    const absent = B10018.abilities.find((ability) => ability.id === 'a3')!.condition!;
    const effectCtx = ctx('a3');
    state.players.self.file = Array.from({ length: 8 }, (_, i) => ({ type: 'card-back' as const, cardId: `file:${i}` }));
    expect(candidates(state, { kind: 'all', query: { area: ['scene', 'set-card'], side: 'self', filter: { trait: 'ガジェット' } } }, effectCtx)).toHaveLength(2);
    expect(evalCond(state, absent, effectCtx)).toBe(false);
    state.players.self.scene = [state.players.self.scene[2]!];
    expect(evalCond(state, absent, effectCtx)).toBe(true);
  });

  it('does not let the belt itself block its FILE8 no-gadget condition', () => {
    const state = createEmptyGameState();
    state.players.self.file = Array.from({ length: 8 }, (_, i) => ({ type: 'card-back' as const, cardId: `file:${i}` }));
    state.players.self.scene = [sceneChar('SOCCER', 'host', { setCards: [{ cardId: 'B10018', faceUp: true, instanceId: 'belt' }] })];

    const absent = B10018.abilities.find((ability) => ability.id === 'a3')!.condition!;
    expect(evalCond(state, absent, ctx('a3'))).toBe(true);
  });

  it('keeps P behavior identical except printing metadata', () => {
    expect({ ...B10018P, id: B10018.id, no: B10018.no, rarity: B10018.rarity, imageUrl: B10018.imageUrl }).toEqual(B10018);
  });
});
