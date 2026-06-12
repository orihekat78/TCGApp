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

// refactor 2a (2026-06-12): paShortFormAwait helper 化に伴い、awaiting-pick 恒久カバレッジが
// 無かった残り 7 verb を characterization として lock する (敵対レビュー指摘の解消)。
// chooser 規約 2 系統 (a.player=操作者 / ctx.source.player=controller) の非対称 probe
// (a.player='opp' × ctx='self') で byPlayer を固定し、将来の Phase 3a 分割の回帰網とする。
describe('PA short-form awaiting-pick characterization — 2a 追加分 (残り7 verb)', () => {
  beforeEach(() => _clearPendingEffectPickQueue());

  it('charRemoveSetCard: byPlayer = a.player (操作者規約)', () => {
    const s = createEmptyGameState();
    setScene(s, 'opp', [char({ uid: 'o1', setCards: [{ cardId: 'X', faceUp: false }] })]);
    runAtom(s, 'charRemoveSetCard', { player: 'opp', max: 1 }, ctx('self', 'B08034'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charRemoveSetCard');
    expect(side.player).toBe('opp');
    expect(side.nMin).toBe(0); expect(side.nMax).toBe(1);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:charRemoveSetCard:awaiting-pick');
  });

  it('sceneToHand: byPlayer = a.player (操作者規約)、side 既定 = a.player', () => {
    const s = createEmptyGameState();
    setScene(s, 'opp', [char({ uid: 'o1' })]);
    runAtom(s, 'sceneToHand', { player: 'opp', max: 1 }, ctx('self', 'B05071'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('sceneToHand');
    expect(side.player).toBe('opp');
    expect(side.candidates.map(c => c.uid)).toContain('o1');
    expect(s.log[s.log.length - 1]?.action).toBe('effect:sceneToHand:awaiting-pick');
  });

  it('sceneToDeck: byPlayer = ctx.source.player (controller 規約)、side 既定 = a.player', () => {
    const s = createEmptyGameState();
    setScene(s, 'opp', [char({ uid: 'o1' })]);
    runAtom(s, 'sceneToDeck', { player: 'opp', max: 1 }, ctx('self', 'B07080'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('sceneToDeck');
    expect(side.player).toBe('self'); // chooser = controller (a.player ではない)
    expect(side.candidates.map(c => c.uid)).toContain('o1'); // 候補は a.player 側
    expect(s.log[s.log.length - 1]?.action).toBe('effect:sceneToDeck:awaiting-pick');
  });

  it('charModifyLevel: byPlayer = ctx.source.player、side 既定 either', () => {
    const s = createEmptyGameState();
    setScene(s, 'self', [char({ uid: 's1' })]);
    setScene(s, 'opp', [char({ uid: 'o1', cardId: 'D08008' })]);
    runAtom(s, 'charModifyLevel', { delta: -2, max: 1 }, ctx('self', 'B07065'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charModifyLevel');
    expect(side.player).toBe('self');
    expect(side.candidates.map(c => c.uid).sort()).toEqual(['o1', 's1']); // either
    expect(s.log[s.log.length - 1]?.action).toBe('effect:charModifyLevel:awaiting-pick');
  });

  it('charGrantKeyword: byPlayer = ctx.source.player (controller 規約)、side 既定 = a.player', () => {
    const s = createEmptyGameState();
    setScene(s, 'opp', [char({ uid: 'o1' })]);
    runAtom(s, 'charGrantKeyword', { player: 'opp', keyword: 'ブレット', scope: 'turn', max: 1 }, ctx('self', 'B09032'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charGrantKeyword');
    expect(side.player).toBe('self');
    expect(side.candidates.map(c => c.uid)).toContain('o1');
    expect(s.log[s.log.length - 1]?.action).toBe('effect:charGrantKeyword:awaiting-pick');
  });

  it('charGrantAbility: byPlayer = ctx.source.player (controller 規約)、side 既定 = a.player', () => {
    const s = createEmptyGameState();
    setScene(s, 'self', [char({ uid: 's1' })]);
    runAtom(s, 'charGrantAbility', { player: 'self', ability: { trigger: { hook: 'turn:end' }, effect: { kind: 'atom', verb: 'noop', args: {} } }, scope: 'turn', max: 1 }, ctx('self', 'B02014'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charGrantAbility');
    expect(side.player).toBe('self');
    expect(side.candidates.map(c => c.uid)).toContain('s1');
    expect(s.log[s.log.length - 1]?.action).toBe('effect:charGrantAbility:awaiting-pick');
  });

  it('charSetCard (fromDeckTop): byPlayer = ctx.source.player (BUG-120 lock)、side 既定 = a.player', () => {
    const s = createEmptyGameState();
    setScene(s, 'opp', [char({ uid: 'o1' })]);
    s.players.opp.deck.push('D1', 'D2');
    runAtom(s, 'charSetCard', { player: 'opp', fromDeckTop: 1, faceUp: false, max: 1 }, ctx('self', 'B02020'));
    const side = _drainPendingEffectPickSide()!;
    expect(side.atomVerb).toBe('charSetCard');
    expect(side.player).toBe('self'); // BUG-120: controller が選ぶ (旧バグ: a.player が選んでいた)
    expect(side.candidates.map(c => c.uid)).toContain('o1');
    expect(s.log[s.log.length - 1]?.action).toBe('effect:charSetCard:awaiting-pick');
  });
});
