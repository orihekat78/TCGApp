// tests/cards/night-wB1/B03063 死闘 probe — Cluster WB1: sceneSetState dyn-max pick
//   「自分の現場の〚空手家〛と同じ数まで相手キャラをスリープ」= sceneSetState max:{dyn:'$self.sceneTrait.空手家'}
//   「自分の現場の〚空手家〛すべてを AP+1000 turn」= forEach all + charModifyAP $each.uid
// production dispatch 経由 (handUseCard = event-use effect:declared)。
// rules: 03 (scene), 11/15 (「まで」=0可), 17 (hirameki), 19/20.
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _resetPendingHirameki, _peekPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { sceneChar } from '../../helpers/fixtures';
import { B03063 } from '@/cards/ct-p03/B03063';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  sceneChar(cardId, uid, { state });
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const FB = { type: 'card-back' as const, cardId: 'FILL' };
const KARATE = def('KARATE', { names: ['空手A'], traits: ['空手家'], ap: 3000 });
const KARATE2 = def('KARATE2', { names: ['空手B'], traits: ['空手家'], ap: 3000 });
const NONK = def('NONK', { names: ['非空手'], traits: ['探偵'], ap: 3000 });
const OPPA = def('OPPA', { names: ['敵A'] });
const OPPB = def('OPPB', { names: ['敵B'] });
const OPPC = def('OPPC', { names: ['敵C'] });
const ALL_DEFS = [B03063, def('FILL'), KARATE, KARATE2, NONK, OPPA, OPPB, OPPC];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2'];
  s.players.opp.deck = ['ODK1', 'ODK2'];
  s.players.self.hand = ['B03063'];
  s.players.self.case.colors = ['白'];        // rules/20 事件色一致
  s.players.self.file = Array.from({ length: 5 }, () => ({ ...FB })); // level5 ≤ FILE
  return s;
}
beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _resetPendingHirameki();
  setHuman('self');
  for (const d of ALL_DEFS) registerCardDef(d);
  registerTriggeredListener();
});

describe('B03063 a1 — sceneSetState dyn-max = 自空手家数', () => {
  it('自空手家2体 → max2 pick surface / 相手2体スリープ + 空手家全員 AP+1000', () => {
    const s = base();
    s.players.self.scene = [sc('KARATE', 'k1'), sc('KARATE2', 'k2')];
    s.players.opp.scene = [sc('OPPA', 'o1'), sc('OPPB', 'o2'), sc('OPPC', 'o3')];
    expect(readChar.ap(s, 'k1')).toBe(3000);

    handUseCard(s, 'self', 'B03063');
    runAllUntilEmpty(s);
    expect(s.players.self.remove, 'イベント使用済').toContain('B03063');

    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb, 'sceneSetState pick surface').toBe('sceneSetState');
    expect(pick!.nMin, '「まで」= 0').toBe(0);
    expect(pick!.nMax, 'dyn-max = 空手家2体').toBe(2);
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    expect(cands.map(c => c.cardId).sort(), '候補 = 相手3体のみ (自陣は対象外)').toEqual(['OPPA', 'OPPB', 'OPPC']);

    applyPickAndContinuation(s, pick!, 'o1', ['o1', 'o2']);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.find(c => c.uid === 'o1')!.state, 'o1 スリープ').toBe('sleep');
    expect(s.players.opp.scene.find(c => c.uid === 'o2')!.state, 'o2 スリープ').toBe('sleep');
    expect(s.players.opp.scene.find(c => c.uid === 'o3')!.state, 'o3 未選択 = active').toBe('active');
    // forEach all 自空手家 → AP+1000 turn
    expect(readChar.ap(s, 'k1'), '空手家 k1 AP+1000').toBe(4000);
    expect(readChar.ap(s, 'k2'), '空手家 k2 AP+1000').toBe(4000);
  });

  it('自空手家0体 → dyn-max-0 で pick 不出現 / 相手不変 / AP 加算なし', () => {
    const s = base();
    s.players.self.scene = [sc('NONK', 'n1')]; // 空手家 0
    s.players.opp.scene = [sc('OPPA', 'o1')];
    handUseCard(s, 'self', 'B03063');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'dyn-max-0 → pick 出さない').toBeFalsy();
    expect(s.players.opp.scene.find(c => c.uid === 'o1')!.state, '相手 active のまま').toBe('active');
    expect(readChar.ap(s, 'n1'), '非空手家は AP 不変').toBe(3000);
  });

  it('自空手家1体 → max1 pick (上限が空手家数に連動)', () => {
    const s = base();
    s.players.self.scene = [sc('KARATE', 'k1'), sc('NONK', 'n1')];
    s.players.opp.scene = [sc('OPPA', 'o1'), sc('OPPB', 'o2')];
    handUseCard(s, 'self', 'B03063');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick!.nMax, 'dyn-max = 空手家1体').toBe(1);
    applyPickAndContinuation(s, pick!, 'o1', ['o1']);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.find(c => c.uid === 'o1')!.state).toBe('sleep');
    expect(s.players.opp.scene.find(c => c.uid === 'o2')!.state).toBe('active');
    expect(readChar.ap(s, 'k1'), '空手家 AP+1000').toBe(4000);
    expect(readChar.ap(s, 'n1'), '非空手家 AP 不変').toBe(3000);
  });
});

describe('B03063 a2 — 【ヒラメキ】evidence:remove-by-action で pending push', () => {
  it('B03063 が証拠から action リムーブ → pendingHirameki push (a2)', () => {
    const s = base();
    event.emit(s, 'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'B03063' }, byUid: 'atk' },
      { player: 'self', uid: 'atk' });
    const pend = _peekPendingHirameki();
    expect(pend, 'B03063 のヒラメキが pending へ').not.toBeNull();
    expect(pend!.cardId).toBe('B03063');
    expect(pend!.abilityId).toBe('a2');
  });
});
