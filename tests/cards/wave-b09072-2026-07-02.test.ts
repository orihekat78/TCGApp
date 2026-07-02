// wave-9 (2026-07-02) — B09072 横溝重悟 (engine変更0)。
// wave-8 shippuFiredThisTurn flag の**初 consumer** (a1) + carrier-reuse (a2 sceneSetState carrier +
// charSetTurnEffect rider) + hirameki-draw (a3) の E2E 検証。
//   a1: 【登場時】疾風がこのターン発動済 → デッキ上2リムーブ + 1ドロー (flag=false は no-op)。
//   a2: 【宣言】【ターン1】cost[スリープ+手札1リムーブ] → 神奈川県警を1枚まで active化 + 推理不可 (rules/11 canReason gate)。
//   a3: 【ヒラメキ】(evidence:remove-by-action) 1ドロー。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { cards as engineCards } from '@/engine/cards/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { drainAiEffectPicks, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { char as readChar } from '@/engine/read/char';
import { canReason } from '@/engine/flow/main/reasoning';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import { B09072 } from '@/cards/ct-p09/B09072';
import { B09072P } from '@/cards/ct-p09/B09072P';
import { B09072P2 } from '@/cards/ct-p09/B09072P2';
import { D01003 } from '@/cards/ct-d01/D01003';
import type { GameState, CardDef, EffectCtx, AbilityDef } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'], level: 6, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function summonFrom(cardId: string): unknown {
  return { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } } };
}
// 疾風 a1 (enter + enterOrderEquals:1) — wave-8 canonical shippu shape
const shippuA1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【疾風】draw', ruleRefs: [],
};
const srcCtx: EffectCtx = { source: { cardId: 'SRC', uid: 'src#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };

describe('B09072 横溝重悟 — wave-9 (engine変更0)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    registerCardDef(B09072);
    registerCardDef(pchar('SHIPPU', { traits: ['神奈川県警'], abilities: [shippuA1] }));
    registerCardDef(pchar('KANAGAWA', { traits: ['警察', '神奈川県警'] }));
    registerCardDef(pchar('OPPKANAGAWA', { traits: ['警察', '神奈川県警'] }));
    registerCardDef(pchar('DECOY', { traits: ['警察', '警視庁'] }));
    engineCards.register(B09072);
    engineCards.register(pchar('KANAGAWA', { traits: ['警察', '神奈川県警'] }));
    engineCards.register(pchar('OPPKANAGAWA', { traits: ['警察', '神奈川県警'] }));
    engineCards.register(pchar('DECOY', { traits: ['警察', '警視庁'] }));
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  // ===== descriptor sanity =====
  it('descriptor: a1 triggered-enter(conditional flag→mill+draw) / a2 declared cost[sleep+hand] carrier+rider / a3 hirameki draw', () => {
    expect(B09072).toMatchObject({ id: 'B09072', kind: 'character', level: 6, ap: 5000, lp: 1, traits: ['警察', '神奈川県警'] });
    const [a1, a2, a3] = B09072.abilities as AbilityDef[];
    // a1
    expect(a1).toMatchObject({ type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true } });
    expect((a1.effect as { kind: string; if: unknown }).kind).toBe('conditional');
    expect((a1.effect as { if: { kind: string; key: string } }).if).toMatchObject({ kind: 'flag', player: 'self', key: 'shippuFiredThisTurn', v: true });
    // a2
    expect(a2).toMatchObject({ type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 } });
    expect((a2.cost as { kind: string; items: Array<{ kind: string }> }).items.map(i => i.kind)).toEqual(['sleepSelf', 'removeFromHand']);
    const steps = (a2.effect as { steps: Array<{ verb?: string; args?: Record<string, unknown> }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', filter: { trait: '神奈川県警' }, state: 'active', bind: '$picked' } });
    expect(steps[1]).toMatchObject({ verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'cannotReason', val: true } });
    // a3
    expect(a3).toMatchObject({ type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true } });
    expect(a3.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
    // parallels = 同一 ability shape
    expect(B09072P.abilities).toEqual(B09072.abilities);
    expect(B09072P2.abilities).toEqual(B09072.abilities);
    expect([B09072P.id, B09072P2.id]).toEqual(['B09072P', 'B09072P2']);
    // a3 = 出荷済 hirameki-draw (D01003) と trigger/effect byte 等価 (clone pattern 検証、リスナー配線は infra 既検)
    const d01003Hira = (D01003.abilities as AbilityDef[]).find(a => a.trigger?.hook === 'evidence:remove-by-action')!;
    expect(a3.trigger).toEqual(d01003Hira.trigger);
    expect(a3.effect).toEqual(d01003Hira.effect);
  });

  // ===== a1 E2E: 疾風発動済 → 登場で deck-2 + draw1 (wave-8 flag consumer 生きた検証) =====
  it('a1 E2E: 先に疾風発動 (flag set) → B09072 登場 → デッキ上2リムーブ + 1ドロー', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['D1', 'D2', 'D3', 'D4', 'D5'];
    s.players.self.remove = ['SHIPPU', 'B09072'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('SHIPPU'), srcCtx);  // 疾風 (1番目登場) → shippuFiredThisTurn=true
      runAllUntilEmpty(d);
    });
    expect(s.turnState.self.shippuFiredThisTurn, '疾風発動記録').toBe(true);
    const deckAfterShippu = s.players.self.deck.length; // SHIPPU draw で -1
    const handAfterShippu = s.players.self.hand.length;
    s = produce(s, (d) => {
      runEffect(d, summonFrom('B09072'), srcCtx); // 登場 → a1 conditional true → mill2 + draw1
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(c => c.cardId === 'B09072'), 'B09072 登場').toBeTruthy();
    // mill 2 (remove) + draw 1 → deck -3、hand +1
    expect(s.players.self.deck.length, 'deck: mill2 + draw1 = -3').toBe(deckAfterShippu - 3);
    expect(s.players.self.hand.length, 'draw +1').toBe(handAfterShippu + 1);
    // SHIPPU draw が D1 を hand へ → mill2 は D2/D3 を remove へ
    expect(s.players.self.remove.filter(c => c === 'D2' || c === 'D3').length, 'デッキ上2枚 (D2/D3) が remove へ').toBe(2);
  });

  // ===== a1 negative: 疾風未発動 (flag false) → 登場しても no-op =====
  it('a1 negative: 疾風未発動 → B09072 登場で deck/hand 不変', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['D1', 'D2', 'D3', 'D4', 'D5'];
    s.players.self.remove = ['B09072'];
    const deck0 = s.players.self.deck.length, hand0 = s.players.self.hand.length;
    s = produce(s, (d) => {
      runEffect(d, summonFrom('B09072'), srcCtx);
      runAllUntilEmpty(d);
    });
    expect(s.turnState.self.shippuFiredThisTurn, '疾風未発動').not.toBe(true);
    expect(s.players.self.deck.length, 'deck 不変 (a1 no-op)').toBe(deck0);
    expect(s.players.self.hand.length, 'hand 不変').toBe(hand0);
  });

  // ===== a1 refresh edge (QA): deck=1 → 可能な限りリムーブ(1) → refresh → draw1 =====
  it('a1 refresh edge: deck=1 で疾風発動済 → 1リムーブ→refresh→draw1 (QA)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['ONLY'];
    s.players.self.remove = ['R1', 'R2', 'R3', 'B09072']; // refresh 用の弾 (0枚だと敗北)
    s.turnState.self.shippuFiredThisTurn = true; // 疾風発動済とみなす
    s = produce(s, (d) => {
      runEffect(d, summonFrom('B09072'), srcCtx);
      runAllUntilEmpty(d);
    });
    expect(s.gameResult, 'refresh 成功 (敗北しない)').toBeUndefined();
    // mill 2: ONLY を1枚 remove (deck0) → refresh (remove→deck) → 残り1枚は追加リムーブせず → draw1
    expect(s.players.self.hand.length, 'draw 1 は解決 (QA)').toBe(1);
  });

  // ===== a2 AI: 神奈川県警(k#1)=DECOY(d#1) 混在盤面。cost(hand-1 支払) + 神奈川県警のみ effect対象 =====
  //   ※ 横溝自身(y#1)も trait[神奈川県警] ゆえ effect の合法対象 (rules/15 自身選択可)。AI が y#1/k#1 いずれを
  //     選んでも「神奈川県警のキャラが active + cannotReason」になり、DECOY(警視庁) は不変。cost sleep は
  //     effect で self を選び直すと上書きされうる (合法) ため self-state は主張しない。
  it('a2 AI: cost で手札1リムーブ、神奈川県警キャラに active+cannotReason (canReason=false)、DECOY(警視庁)不変、【ターン1】消費', () => {
    setHuman(null);
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['H1']; // removeFromHand cost 用
    s.players.self.scene = [
      sceneChar('B09072', 'y#1'),
      sceneChar('KANAGAWA', 'k#1', { state: 'sleep' }),
      sceneChar('DECOY', 'd#1', { state: 'sleep' }),
    ];
    expect(canDeclaredAbility(s, 'y#1', 'a2'), '宣言可').toBe(true);
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'y#1', 'a2');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    // cost: 手札1リムーブ (unambiguous)
    expect(s.players.self.hand.length, 'cost: 手札1リムーブ').toBe(0);
    // effect: 神奈川県警 (k#1 or y#1) が active + cannotReason (推理不可)
    const kanagawa = ['k#1', 'y#1'].map(u => s.players.self.scene.find(c => c.uid === u)!).filter(Boolean);
    const activated = kanagawa.filter(c => c.turnEffects?.['cannotReason'] === true);
    expect(activated.length, '神奈川県警 1体に cannotReason').toBe(1);
    expect(readChar.state(s, activated[0]!.uid), '付与対象は active').toBe('active');
    expect(canReason(s, activated[0]!.uid), '推理不可 (canReason=false)').toBe(false);
    // DECOY(警視庁) 不変
    expect(readChar.state(s, 'd#1'), 'decoy(警視庁) 不変 sleep').toBe('sleep');
    expect(s.players.self.scene.find(c => c.uid === 'd#1')?.turnEffects?.['cannotReason'], 'decoy に cannotReason なし').toBeUndefined();
    // 【ターン1】消費
    expect(canDeclaredAbility(s, 'y#1', 'a2'), '【ターン1】使用済').toBe(false);
  });

  // ===== a2 human: pick surface + trait filter (DECOY 除外) + decline 可 =====
  it('a2 human: pick surface (sceneSetState/nMin0)、候補=神奈川県警 (DECOY除外)、選択で cannotReason 付与', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['H1'];
    s.players.self.scene = [
      sceneChar('B09072', 'y#1'),
      sceneChar('KANAGAWA', 'k#1', { state: 'sleep' }),
      sceneChar('DECOY', 'd#1', { state: 'sleep' }),
    ];
    s.players.opp.scene = [
      sceneChar('OPPKANAGAWA', 'ok#1', { state: 'sleep' }), // side:'either' 実証: 相手側 神奈川県警 も候補
      sceneChar('DECOY', 'od#1', { state: 'sleep' }),
    ];
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'y#1', 'a2');
      runAllUntilEmpty(d);
    });
    expect(_peekPendingEffectPickQueueLength(), 'pick surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb).toBe('sceneSetState');
    expect(pending.nMin, '「〜まで」=0枚可').toBe(0);
    const cand = pending.candidates.map(c => c.uid);
    expect(cand, 'k#1 (自 神奈川県警) が候補').toContain('k#1');
    expect(cand, 'ok#1 (相手 神奈川県警) も候補 = side:either (unscoped, rules/15)').toContain('ok#1');
    expect(cand, 'decoy(警視庁 d#1) は trait filter で除外').not.toContain('d#1');
    expect(cand, 'opp decoy(警視庁 od#1) も trait filter で除外').not.toContain('od#1');

    s = produce(s, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    const anyActivated = ['k#1', 'y#1'].some(u => s.players.self.scene.find(x => x.uid === u)?.turnEffects?.['cannotReason'] === true);
    expect(anyActivated, '選択した神奈川県警に cannotReason 付与').toBe(true);
  });
});
