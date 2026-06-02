// 新規 verb 短縮形 test (Phase2 Task2.4-2.7)
// sceneSetState / charModifyLP / sceneEnter(area) + charModifyAP dyn-delta が
// 短縮形 args で scene/remove pick を side-channel に push することを検証する。

import { describe, it, expect, beforeEach } from 'vitest';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import type { EffectCtx, GameState, SceneCharacter } from '@/engine/types';

function ctx(player: 'self' | 'opp' = 'self', cardId = 'CARD', abilityId = 'a1'): EffectCtx {
  return { source: { player, area: 'scene', cardId, abilityId }, bindings: {} };
}
function char(overrides: Partial<SceneCharacter> = {}): SceneCharacter {
  return {
    cardId: 'D08007', uid: 'u1', state: 'active', isNamed: false, enterOrder: 1,
    setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    ...overrides,
  };
}
function setScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): void { s.players[p].scene = chars; }

describe('short-form new verbs (Task2.4-2.7)', () => {
  beforeEach(() => _clearPendingEffectPickQueue());

  it('Task2.4 sceneSetState 短縮形 {player,max,side,state} → scene pick を push', () => {
    const s = createEmptyGameState();
    setScene(s, 'self', [char({ uid: 's1' })]);
    runAtom(s, 'sceneSetState', { player: 'self', max: 1, side: 'either', state: 'sleep' }, ctx('self', 'D08019'));
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('sceneSetState');
    expect(side.player).toBe('self');
    expect(side.nMin).toBe(0); expect(side.nMax).toBe(1);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:sceneSetState:awaiting-pick');
  });

  it('Task2.5 charModifyLP 短縮形 {delta,max,side} → scene pick を push, byPlayer=ctx.source.player', () => {
    const s = createEmptyGameState();
    setScene(s, 'self', [char({ uid: 's1' })]);
    runAtom(s, 'charModifyLP', { delta: 1, max: 1, side: 'self' }, ctx('self', 'D11012'));
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charModifyLP');
    expect(side.player).toBe('self');
    expect(side.nMax).toBe(1);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:charModifyLP:awaiting-pick');
  });

  it('Task2.6 sceneEnter 短縮形 {player,from,max} → remove pick を push (cardId=$pick.cardId)', () => {
    const s = createEmptyGameState();
    s.players.self.remove.push('D08019');
    runAtom(s, 'sceneEnter', { player: 'self', from: 'remove', max: 1 }, ctx('self', 'D08024'));
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('sceneEnter');
    expect(side.player).toBe('self');
    expect(side.nMin).toBe(0); expect(side.nMax).toBe(1);
    expect(side.candidates.map(c => c.cardId)).toContain('D08019');
    expect(s.log[s.log.length - 1]?.action).toBe('effect:sceneEnter:awaiting-pick');
  });

  // dyn-delta は push 時に resolveDynArgs で literal 化される (BUG-085)。$cost は ctx.costPaid を参照するので供給する。
  it('Task2.7 charModifyAP 短縮形が delta:{dyn} を受理 (D08026/D11021)', () => {
    const s = createEmptyGameState();
    setScene(s, 'self', [char({ uid: 's1' })]);
    const cctx: EffectCtx = { source: { player: 'self', area: 'case', cardId: 'D08026', abilityId: 'a2' }, bindings: {}, costPaid: { flipFaceUpEvidence: { count: 2 } } };
    runAtom(s, 'charModifyAP', { delta: { dyn: '$cost.flipFaceUpEvidence.count * 1000' }, max: 1, side: 'either' }, cctx);
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charModifyAP');
    expect(side.nMax).toBe(1);
    expect((side.atomArgs as { delta?: unknown }).delta).toBe(2000); // dyn が literal 化されている
  });

  it('Task2.7 charModifyLP 短縮形も delta:{dyn} を受理', () => {
    const s = createEmptyGameState();
    setScene(s, 'self', [char({ uid: 's1' })]);
    const cctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D11012', abilityId: 'a1' }, bindings: {}, costPaid: { flipFaceUpEvidence: { count: 1 } } };
    runAtom(s, 'charModifyLP', { delta: { dyn: '$cost.flipFaceUpEvidence.count * 1' }, max: 1, side: 'self' }, cctx);
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
  });
});
