// 短縮形 characterization test (Phase2 refactor の動作不変オラクル)
// spec: docs/superpowers/plans/2026-06-02-card-atom-compaction.md Task 2.1
//
// 目的: ATOM_PICK_SPEC + normalizeAtomShortForm への一本化 (refactor) の前後で、
// pick系 atom 短縮形の挙動 (side-channel push / verb / nMin・nMax / byPlayer / log) が
// 不変であることを保証する。移行 *前* に PASS することを確認 → 移行後も PASS = 動作不変。

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

function setScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): void {
  s.players[p].scene = chars;
}

describe('short-form characterization (動作不変オラクル)', () => {
  beforeEach(() => _clearPendingEffectPickQueue());

  it('PB discard 短縮形 {player,n} → runtime で hand pick を side-channel push', () => {
    const s = createEmptyGameState();
    s.players.self.hand.push('A', 'B');
    runAtom(s, 'discard', { player: 'self', n: 1 }, ctx('self', 'D08015'));
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('discard');
    expect(side.player).toBe('self');
    expect(side.nMin).toBe(1); expect(side.nMax).toBe(1);
    expect(side.candidates.map(c => c.cardId).sort()).toEqual(['A', 'B']);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:discard:awaiting-pick');
  });

  it('PB discard 短縮形 {player,max} → nMin0/nMax (skip 可)', () => {
    const s = createEmptyGameState();
    s.players.self.hand.push('A');
    runAtom(s, 'discard', { player: 'self', max: 1 }, ctx('self'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.nMin).toBe(0); expect(side.nMax).toBe(1);
  });

  it('PB evidenceToHand 短縮形 {player,n} → evidence pick を push', () => {
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'effect' } });
    runAtom(s, 'evidenceToHand', { player: 'self', n: 1 }, ctx('self', 'D08013'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('evidenceToHand');
    expect(side.player).toBe('self');
    expect(side.nMin).toBe(1); expect(side.nMax).toBe(1);
  });

  it('PA sceneRemove 短縮形 {player,max,side,filter} → scene pick を push (nMin0)', () => {
    const s = createEmptyGameState();
    setScene(s, 'opp', [char({ uid: 'o1', cardId: 'D08007' })]); // D08007 AP1000 ≤ 8000
    runAtom(s, 'sceneRemove', { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } }, ctx('self', 'D08003'));
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('sceneRemove');
    expect(side.player).toBe('self'); // byPlayer = resolved player
    expect(side.nMin).toBe(0); expect(side.nMax).toBe(1);
    expect(side.candidates.map(c => c.uid)).toContain('o1');
    expect(s.log[s.log.length - 1]?.action).toBe('effect:sceneRemove:awaiting-pick');
  });

  // 注: card registry は unit test では未登録なので trait filter は使わず無 filter で characterize。
  // byPlayer = ctx.source.player (a.player ではない) 点を lock するのが本ケースの主眼。
  it('PA charModifyAP 短縮形 {delta,max,side} → scene pick を push, byPlayer=ctx.source.player', () => {
    const s = createEmptyGameState();
    setScene(s, 'self', [char({ uid: 's1', cardId: 'D08007' })]);
    runAtom(s, 'charModifyAP', { delta: 1000, max: 1, side: 'either' }, ctx('self', 'D08024'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charModifyAP');
    expect(side.player).toBe('self');
    expect(side.nMin).toBe(0); expect(side.nMax).toBe(1);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:charModifyAP:awaiting-pick');
  });

  it('明示 target (旧形式) は短縮形に乗らず従来どおり pick query で push', () => {
    const s = createEmptyGameState();
    s.players.self.hand.push('A', 'B');
    runAtom(s, 'discard', { player: 'self', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 } } }, ctx('self'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('discard');
    expect(side.nMin).toBe(1); expect(side.nMax).toBe(1);
  });
});
