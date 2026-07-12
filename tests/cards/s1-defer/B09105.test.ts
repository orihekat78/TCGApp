// tests/cards/s1-defer/B09105 キッ — S1 defer-unlock probe (owner='opp' 固定)
//
// effect = sequence[ optional{ chain[ partnerSetState(requireActive) → discard → fileRemoveTop(requireExact,n:2)
//   → sceneEnter(distinctLevel, 犯人, levelMax:8, 0-5) ] }, setNextHintBan ]
// condition = caseTrait '犯人' (【事件犯人】)。
//
// gate 経路 (payload 必須):
//   ① 全条件揃い → 5枚まで登場 + レベル重複 pick 弾かれる (distinctLevel greedy)
//   ② FILE 1枚のみ → fileRemoveTop は1枚リムーブ (可能な限り) だが以降 (sceneEnter) skip (requireExact)
//   ③ パートナー既スリープ → chain 全 skip (requireActive、FILE 減らない・partner sleep のまま)
//   ④ optional decline → 登場なし、**setNextHintBan は適用される** (ban は optional の外)
//   ⑤ 事件が特徴[犯人]を持たない → 効果全体が何も起こらない (rules/17 持っていない扱い、ban も立たない)
//   ⑥ owner=opp (全 probe で pin)
// rules: 03, 12, 15 §「まで」=0可/してもよい, 17, 20 §スイッチ, 25

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B09105 } from '@/cards/ct-p09/B09105';
import { B09105P } from '@/cards/ct-p09/B09105P';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'FILL' };

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黒'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function caseDef(id: string, caseTraits: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'case', names: [id], colors: ['黒'], level: 8, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], caseTraits };
}

// 犯人 char defs: レベル 1..5 (H5a/H5b は同レベル5 = distinctLevel decoy)
const H1 = 'H1', H2 = 'H2', H3 = 'H3', H4 = 'H4', H5a = 'H5a', H5b = 'H5b';
const H9 = 'H9';        // 犯人 だが レベル9 (levelMax:8 超過 decoy)
const NONH = 'NONH';    // レベル3 だが 犯人 でない (trait decoy)
const HANDX = 'HANDX';  // 手札 discard 対象
const CASE_H = 'CASE_H';   // 事件 (犯人)
const CASE_P = 'CASE_P';   // 事件 (犯人でない)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerCardDef(B09105);
  registerCardDef(B09105P);
  registerCardDef(ch(H1, { level: 1, traits: ['犯人'] }));
  registerCardDef(ch(H2, { level: 2, traits: ['犯人'] }));
  registerCardDef(ch(H3, { level: 3, traits: ['犯人'] }));
  registerCardDef(ch(H4, { level: 4, traits: ['犯人'] }));
  registerCardDef(ch(H5a, { level: 5, traits: ['犯人'] }));
  registerCardDef(ch(H5b, { level: 5, traits: ['犯人'] }));
  registerCardDef(ch(H9, { level: 9, traits: ['犯人'] }));
  registerCardDef(ch(NONH, { level: 3, traits: [] }));
  registerCardDef(ch(HANDX, { level: 2 }));
  registerCardDef(caseDef(CASE_H, ['犯人']));
  registerCardDef(caseDef(CASE_P, []));
  registerTriggeredListener();
});

function oppTurn(s: GameState): void {
  s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
}

/** effect を owner=opp で直接駆動 (optionalRun を渡し pick は AI 解決)。case は既定 CASE_H (犯人)。 */
function driveDirect(optionalRun: boolean, setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  oppTurn(s);
  s.players.opp.case.cardId = CASE_H;
  setup(s);
  const eff = B09105.abilities.find((a) => a.id === 'a1')!.effect;
  s = produce(s, (d) => {
    const ctx = { source: { player: 'opp', cardId: 'B09105', uid: 'kid#1', abilityId: 'a1', area: 'hand' }, bindings: {}, dyn: { optionalRun } } as unknown as EffectCtx;
    runEffect(d, eff as never, ctx);
    for (let i = 0; i < 6; i++) { runAllUntilEmpty(d); _drainAllEffectPicksForTest(d, new HeuristicPolicy()); runAllUntilEmpty(d); }
  });
  return s;
}

/** 本番 event-use 経路: B09105 を opp 手札に置き effect:declared{event-use} を emit → triggered listener が
 *  condition (caseTrait) を評価して発火判定。AI は optional を auto-skip する。 */
function driveViaEmit(caseCardId: string, setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  oppTurn(s);
  s.players.opp.case.cardId = caseCardId;
  s.players.opp.hand = ['B09105'];
  setup(s);
  s = produce(s, (d) => {
    event.emit(d, 'effect:declared', { kind: 'event-use', cardId: 'B09105', player: 'opp', viaEffect: false }, { player: 'opp', cardId: 'B09105' });
    for (let i = 0; i < 6; i++) { runAllUntilEmpty(d); _drainAllEffectPicksForTest(d, new HeuristicPolicy()); runAllUntilEmpty(d); }
  });
  return s;
}

const banned = (s: GameState) => s.turnState.opp.nextHintBanned === true;
const inScene = (s: GameState, id: string) => s.players.opp.scene.some((c) => c.cardId === id);

// ============================================================
// ① 全条件揃い → 5枚まで登場 + レベル重複 pick 弾かれる
// ============================================================
describe('B09105 ① happy path (distinctLevel greedy, requireActive OK, requireExact OK)', () => {
  it('レベル相異5体登場 + 重複Lv5/Lv9超過/非犯人は非対象、partner sleep・FILE-2・hand-1・ban', () => {
    const s = driveDirect(true, (st) => {
      st.players.opp.remove = [H1, H2, H3, H4, H5a, H5b, H9, NONH];
      st.players.opp.file = [FB, FB, FB];
      st.players.opp.hand = [HANDX];
      // partner は既定 active
    });
    expect(s.players.opp.scene.length, '5体登場').toBe(5);
    expect(inScene(s, H5a) && inScene(s, H1) && inScene(s, H2) && inScene(s, H3) && inScene(s, H4), 'Lv1-5 各1体').toBe(true);
    expect(inScene(s, H5b), '重複Lv5 (H5b) は distinctLevel で弾かれる').toBe(false);
    expect(s.players.opp.remove.includes(H5b), 'H5b は remove 残').toBe(true);
    expect(inScene(s, H9), 'Lv9 は levelMax:8 で非対象').toBe(false);
    expect(inScene(s, NONH), '非犯人は trait で非対象').toBe(false);
    expect(s.players.opp.partner.state, 'partner スリープ').toBe('sleep');
    expect(s.players.opp.file.length, 'FILE 上2リムーブ').toBe(1);
    expect(s.players.opp.hand.length, '手札1リムーブ').toBe(0);
    expect(banned(s), 'ネクストヒント禁止').toBe(true);
  });
});

// ============================================================
// ② FILE 1枚のみ → requireExact で sceneEnter skip
// ============================================================
describe('B09105 ② FILE=1 requireExact gate', () => {
  it('FILE 1枚リムーブ (可能な限り) だが以降 skip → 登場なし、partner sleep・hand-1・ban', () => {
    const s = driveDirect(true, (st) => {
      st.players.opp.remove = [H1, H2, H3];
      st.players.opp.file = [FB]; // 1枚のみ
      st.players.opp.hand = [HANDX];
    });
    expect(s.players.opp.scene.length, '登場なし (requireExact gate)').toBe(0);
    expect(s.players.opp.file.length, 'FILE は可能な限り1枚リムーブ').toBe(0);
    expect(s.players.opp.partner.state, 'partner スリープ (step1 実行済)').toBe('sleep');
    expect(s.players.opp.hand.length, '手札1リムーブ (step2 実行済)').toBe(0);
    expect(banned(s), 'ban は立つ (optional 外)').toBe(true);
  });
});

// ============================================================
// ③ パートナー既スリープ → requireActive で chain 全 skip
// ============================================================
describe('B09105 ③ partner already sleep — requireActive gate', () => {
  it('chain 全 skip: partner sleep のまま・FILE 減らない・hand 不変・登場なし、ban は立つ', () => {
    const s = driveDirect(true, (st) => {
      st.players.opp.partner.state = 'sleep';
      st.players.opp.remove = [H1, H2, H3];
      st.players.opp.file = [FB, FB, FB];
      st.players.opp.hand = [HANDX];
    });
    expect(s.players.opp.partner.state, 'partner sleep のまま').toBe('sleep');
    expect(s.players.opp.file.length, 'FILE 不変 (fileRemove 未実行)').toBe(3);
    expect(s.players.opp.hand, '手札 不変 (discard 未実行)').toEqual([HANDX]);
    expect(s.players.opp.scene.length, '登場なし').toBe(0);
    expect(banned(s), 'ban は立つ (optional 外)').toBe(true);
  });
});

// ============================================================
// ④ optional decline → 登場なし、setNextHintBan は適用される
// ============================================================
describe('B09105 ④ optional decline — ban は optional の外', () => {
  it('chain 全体不実行 (partner active・FILE 不変・hand 不変) だが ban は立つ', () => {
    const s = driveDirect(false, (st) => {
      st.players.opp.remove = [H1, H2, H3];
      st.players.opp.file = [FB, FB, FB];
      st.players.opp.hand = [HANDX];
    });
    expect(s.players.opp.partner.state, 'partner active のまま').toBe('active');
    expect(s.players.opp.file.length, 'FILE 不変').toBe(3);
    expect(s.players.opp.hand, '手札 不変').toEqual([HANDX]);
    expect(s.players.opp.scene.length, '登場なし').toBe(0);
    expect(banned(s), 'ban は立つ (decline でも独立文)').toBe(true);
  });
});

// ============================================================
// ⑤ 事件が特徴[犯人]を持たない → 効果全体が何も起こらない (condition gate)
// ============================================================
describe('B09105 ⑤ caseTrait gate (via 本番 event-use emit)', () => {
  it('事件が犯人でない → 発火せず: partner active・FILE 不変・ban も立たない', () => {
    const s = driveViaEmit(CASE_P, (st) => {
      st.players.opp.remove = [H1, H2, H3];
      st.players.opp.file = [FB, FB, FB];
    });
    expect(s.players.opp.partner.state, 'partner active').toBe('active');
    expect(s.players.opp.file.length, 'FILE 不変').toBe(3);
    expect(s.players.opp.scene.length, '登場なし').toBe(0);
    expect(banned(s), '効果全体が不発 → ban も立たない').toBe(false);
  });

  it('事件が犯人 → 発火する (AI は optional auto-skip → ban のみ適用・登場なし)', () => {
    const s = driveViaEmit(CASE_H, (st) => {
      st.players.opp.remove = [H1, H2, H3];
      st.players.opp.file = [FB, FB, FB];
    });
    expect(banned(s), 'condition 成立 → ability 発火 → ban 適用').toBe(true);
    expect(s.players.opp.scene.length, 'AI は optional を skip → 登場なし').toBe(0);
    expect(s.players.opp.partner.state, 'optional skip → partner active').toBe('active');
  });
});

// ============================================================
// 構造: B09105P は完全 clone (id/no/rarity/imageUrl のみ差替)
// ============================================================
describe('B09105P — 完全 clone', () => {
  it('id/no/rarity/imageUrl のみ差替、他フィールドは B09105 と一致', () => {
    expect(B09105P.id).toBe('B09105P');
    expect(B09105P.no).toBe('1044/B09105P');
    expect(B09105P.rarity).toBe('CP');
    expect(B09105P.imageUrl).toBe('1775608943981358.jpg');
    expect(B09105P.kind).toBe('event');
    expect(B09105P.colors).toEqual(['黒']);
    expect(B09105P.names).toEqual(['キッ']);
    expect(B09105P.abilities).toBe(B09105.abilities); // 同一 ability 参照
  });
});
