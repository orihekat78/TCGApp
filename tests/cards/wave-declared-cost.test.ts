// wave-declared-cost — B07066 赤井秀一 / PR194 灰原哀 を実 engine 経路で駆動する挙動テスト。
// 既存 verb のみ (engine変更0): enter-observer triggerCharMatches{side:self,payloadKey:uid} /
//   sleepChar cost / removeFromScene self cost / deckRevealUntil{maxN,chooseMatch:upTo|exact-one} /
//   handAddFromDeck / deckToBottomBound / discard / sceneRemove。
// BUG-117/118 lesson: DSL に filter を書いても engine が実評価する保証はないため、
//   decoy を盤面/デッキに置いて outcome で 1対1 検証する。
// B08075「3つまで選んで行う」は DEFER (bare-sequence opt3 unskippable / DEFERRED-INDEX 参照)。
// rules: 03/05/10/11/14/15/17/19/21/24/26 + TSV qAndA (B07066 / PR194 / B01048)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { evalCond } from '@/engine/cond/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { registerAll } from '@/cards/index';
import { makeChar } from '../helpers/fixtures';
import { B07066 } from '@/cards/ct-p07/B07066';
import { PR194 } from '@/cards/pr-01/PR194';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// a1 enter-observer decoys (entering char filter = {trait:赤井家, levelMax:7})
const AKAI7 = 'DEC_AKAI7';     // 赤井家 character level7 → match
const AKAI8 = 'DEC_AKAI8';     // 赤井家 character level8 → 非該当 (levelMax:7)
const TANTEI7 = 'DEC_TANTEI7'; // 探偵 character level7   → 非該当 (trait 赤井家 違反)
// a1 removal decoys (apMax:8000)
const AP5000 = 'DEC_AP5000';   // AP5000 → 除去候補
const AP9000 = 'DEC_AP9000';   // AP9000 → apMax:8000 違反で残る
// a2 deck-look decoys (filter {kind:character, trait:赤井家})
const AKAI_CH = 'DEC_AKAI_CH'; // 赤井家 character → match
const AKAI_EV = 'DEC_AKAI_EV'; // 赤井家 *event*   → kind:character 違反で非該当
const OTHER = 'DEC_OTHER';     // 警察 character   → trait 違反で非該当
// PR194 exact-one pick decoys
const TOP = 'DEC_TOP', SECOND = 'DEC_SECOND', FILL1 = 'DEC_FILL1';

function registerDecoys(): void {
  registerCardDef(ch(AKAI7, { names: ['赤井家7'], traits: ['赤井家'], level: 7 }));
  registerCardDef(ch(AKAI8, { names: ['赤井家8'], traits: ['赤井家'], level: 8 }));
  registerCardDef(ch(TANTEI7, { names: ['探偵7'], traits: ['探偵'], level: 7 }));
  registerCardDef(ch(AP5000, { names: ['AP5千'], traits: ['警察'], ap: 5000 }));
  registerCardDef(ch(AP9000, { names: ['AP9千'], traits: ['警察'], ap: 9000 }));
  registerCardDef(ch(AKAI_CH, { names: ['赤井家ch'], traits: ['赤井家'] }));
  registerCardDef(ch(AKAI_EV, { kind: 'event', names: ['赤井家ev'], traits: ['赤井家'] }));
  registerCardDef(ch(OTHER, { names: ['佐藤刑事'], traits: ['警察'] }));
  registerCardDef(ch(TOP, { names: ['top'] }));
  registerCardDef(ch(SECOND, { names: ['second'] }));
  registerCardDef(ch(FILL1, { names: ['fill'] }));
}

function baseTurn5(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);
const deckBottom = (s: GameState) => s.players.self.deck[s.players.self.deck.length - 1];
const onSelfScene = (s: GameState, uid: string) => s.players.self.scene.find((c) => c.uid === uid);
const onOppScene = (s: GameState, uid: string) => s.players.opp.scene.find((c) => c.uid === uid);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerDecoys();
  registerTriggeredListener();
});

// ============================================================
// B07066 赤井秀一 a1 — enter-observer: 自分側 level≤7 赤井家 の登場で AP8000以下を1枚までリムーブ
// ============================================================
describe('B07066 a1 matcherCondition: 自分側 level≤7 赤井家 の enter のみ発火 (triggerCharMatches 1対1)', () => {
  const mc = () => B07066.abilities.find((a) => a.id === 'a1')!.trigger!.matcherCondition!;

  // bearer = B07066 on self scene。entering char を side の scene に置き triggerPayload.uid で参照。
  function withEnter(side: 'self' | 'opp', enterCardId: string): { s: GameState; ctx: EffectCtx } {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'akai#1', cardId: 'B07066', state: 'active' })];
    s.players[side].scene.push(makeChar({ uid: 'ent#1', cardId: enterCardId, state: 'active' }));
    const ctx: EffectCtx = {
      source: { cardId: 'B07066', uid: 'akai#1', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {}, triggerPayload: { uid: 'ent#1' },
    };
    return { s, ctx };
  }

  it('自分側 赤井家 L7 が登場 → true', () => {
    const { s, ctx } = withEnter('self', AKAI7);
    expect(evalCond(s, mc(), ctx)).toBe(true);
  });
  it('自分側 赤井家 L8 が登場 → false (levelMax:7 違反)', () => {
    const { s, ctx } = withEnter('self', AKAI8);
    expect(evalCond(s, mc(), ctx)).toBe(false);
  });
  it('自分側 探偵 L7 が登場 → false (trait 赤井家 違反)', () => {
    const { s, ctx } = withEnter('self', TANTEI7);
    expect(evalCond(s, mc(), ctx)).toBe(false);
  });
  it('相手側 赤井家 L7 が登場 → false (side:self 違反)', () => {
    const { s, ctx } = withEnter('opp', AKAI7);
    expect(evalCond(s, mc(), ctx)).toBe(false);
  });
});

describe('B07066 a1 effect: AP8000以下を1枚までリムーブ (apMax decoy)', () => {
  it('AP9000 は apMax:8000 違反で必ず残る / AP≤8000 候補が1枚除去される', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'akai#1', cardId: 'B07066', state: 'active' })];
    s.players.opp.scene = [
      makeChar({ uid: 't5k', cardId: AP5000, state: 'sleep' }),
      makeChar({ uid: 't9k', cardId: AP9000, state: 'sleep' }),
    ];
    const eff = B07066.abilities.find((a) => a.id === 'a1')!.effect!;
    const ctx: EffectCtx = { source: { cardId: 'B07066', uid: 'akai#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
    let after = produce(s, (d) => runEffect(d, eff, ctx));
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    // apMax decoy: AP9000 は候補にならない → 必ず残存 (filter 1対1)
    expect(onOppScene(after, 't9k'), 'AP9000 は apMax:8000 で候補外 → 残る').toBeDefined();
    // side:either の AP≤8000 候補 = {AP5000(opp), B07066(self,AP7000)} のいずれか1枚が除去 (max:1)
    const removed5k = !onOppScene(after, 't5k');
    const removedBearer = !onSelfScene(after, 'akai#1');
    expect(removed5k || removedBearer, 'AP≤8000 の候補が1枚除去 (max:1)').toBe(true);
  });
});

// ============================================================
// B07066 赤井秀一 a2 — 宣言: デッキ上3枚見て 赤井家キャラ1枚まで手札→残りデッキ下→加えたら discard1
// ============================================================
describe('B07066 a2 effect: 上から3枚見て(赤井家×character)1枚まで手札→残りデッキ下→加えたら discard1', () => {
  function withDeck(deck: string[]): { s: GameState; ctx: EffectCtx } {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'akai#1', cardId: 'B07066', state: 'active' })];
    s.players.self.deck = deck;
    s.players.self.hand = ['HAND_SEED'];
    const ctx: EffectCtx = { source: { cardId: 'B07066', uid: 'akai#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
    return { s, ctx };
  }
  function run(s: GameState, ctx: EffectCtx): GameState {
    const eff = B07066.abilities.find((a) => a.id === 'a2')!.effect!;
    let after = produce(s, (d) => runEffect(d, eff, ctx));
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    return after;
  }

  it('赤井家 character が窓内 → 手札へ / 加えたので discard1 (手札 net 0)', () => {
    const { s, ctx } = withDeck([AKAI_CH, FILL1, OTHER]);
    const after = run(s, ctx);
    expect(inHand(after, AKAI_CH), '赤井家 character は手札へ').toBe(true);
    expect(inDeck(after, AKAI_CH), 'deck から抜けた').toBe(false);
    expect(after.players.self.hand.length, 'seed(1)+take(1)-discard(1)=1').toBe(1);
  });
  it('赤井家 *event* のみ → kind:character 違反で非該当 → 手札に入らず全部デッキ下 / discard なし', () => {
    const { s, ctx } = withDeck([AKAI_EV, FILL1, OTHER]);
    const after = run(s, ctx);
    expect(inHand(after, AKAI_EV), '赤井家 event は kind 違反で非該当').toBe(false);
    expect(inDeck(after, AKAI_EV), 'event は deck (下) に残る').toBe(true);
    expect(after.players.self.hand.length, '取得なし → discard なし → seed のみ').toBe(1);
  });
  it('警察 character のみ → trait 違反で非該当 → 手札に入らず全部デッキ下', () => {
    const { s, ctx } = withDeck([OTHER, FILL1, AP5000]);
    const after = run(s, ctx);
    expect(inHand(after, OTHER), '警察は trait 赤井家 違反で非該当').toBe(false);
    expect(deckBottom(after), '非match 窓カードがデッキ下 (最下=窓末尾)').toBe(AP5000);
  });
});

// ============================================================
// PR194 灰原哀 a1 — 宣言: 自身リムーブ→上から2枚見て必ず1枚選択して手札→残りデッキ下
// ============================================================
describe('PR194 a1 effect: 上から2枚から必ず1枚選んで手札→残りデッキ下', () => {
  function runEff(deck: string[]): GameState {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'ai#1', cardId: 'PR194', state: 'active' })];
    s.players.self.deck = deck;
    const eff = PR194.abilities.find((a) => a.id === 'a1')!.effect!;
    const ctx: EffectCtx = { source: { cardId: 'PR194', uid: 'ai#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
    let after = produce(s, (d) => runEffect(d, eff, ctx));
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    return after;
  }
  it('2枚の窓からちょうど1枚を手札へ / 残り1枚をデッキ下へ', () => {
    const after = runEff([TOP, SECOND]);
    const looked = [TOP, SECOND];
    expect(looked.filter(cardId => inHand(after, cardId)), '窓内から手札へ入るのは1枚').toHaveLength(1);
    expect(looked.filter(cardId => inDeck(after, cardId)), '窓内に残るのは1枚').toHaveLength(1);
  });
  it('maxN:2 → 窓外(3枚目)は触れない', () => {
    const after = runEff([TOP, SECOND, FILL1]);
    expect([TOP, SECOND].some(cardId => inHand(after, cardId)), '窓内から1枚取得').toBe(true);
    expect(inDeck(after, FILL1), '窓外 FILL1 は deck に残留 (maxN:2)').toBe(true);
  });
});

// ============================================================
// descriptor pins — codegen drift 検出
// ============================================================
describe('B07066 descriptor pin', () => {
  it('a1 = enter-observer (triggerCharMatches side:self payloadKey:uid filter{trait:赤井家,levelMax:7}) + sceneRemove apMax:8000', () => {
    const a1 = B07066.abilities.find((a) => a.id === 'a1')!;
    expect(a1.type).toBe('triggered');
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a1.trigger).toMatchObject({
      hook: 'enter',
      matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { trait: '赤井家', levelMax: 7 } },
    });
    expect(a1.trigger!.selfOnly).toBeUndefined(); // observer = NOT selfOnly
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { apMax: 8000 } } });
  });
  it('a2 = declared + sleepChar(赤井家 self) cost + deckRevealUntil{maxN:3,chooseMatch:upTo,filter{kind:character,trait:赤井家}} + discard1', () => {
    const a2 = B07066.abilities.find((a) => a.id === 'a2')!;
    expect(a2.type).toBe('declared');
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.cost).toMatchObject({
      kind: 'sleepChar',
      target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: '赤井家' } }, n: { min: 1, max: 1 } },
    });
    expect(a2.effect).toMatchObject({
      kind: 'sequence',
      steps: [
        { verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', maxN: 3, filter: { kind: 'character', trait: '赤井家' }, bind: '$revealed', bindMatch: '$matched' } },
        { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { verb: 'handAddFromDeck', args: { cardId: '$matched.cardId' } } },
        { verb: 'deckToBottomBound', args: { bindKey: '$revealed' } },
        { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { verb: 'discard', args: { n: 1 } } },
      ],
    });
  });
});

describe('PR194 descriptor pin', () => {
  it('a1 = declared + removeFromScene(self) cost + bind-only reveal → exact-one bound pick → deckToBottomBound', () => {
    const a1 = PR194.abilities.find((a) => a.id === 'a1')!;
    expect(a1.type).toBe('declared');
    expect(a1.cost).toMatchObject({ kind: 'removeFromScene', target: { kind: 'self' }, n: 1 });
    const steps = (a1.effect as { steps: unknown[] }).steps as Array<Record<string, unknown>>;
    const dr = steps[0] as { verb: string; args: Record<string, unknown> };
    expect(dr.verb).toBe('deckRevealUntil');
    expect(dr.args).toMatchObject({ player: 'self', maxN: 2, bind: '$revealed' });
    expect(dr.args).not.toHaveProperty('bindMatch');
    expect(steps[1]).toMatchObject({
      kind: 'atom',
      verb: 'handAddFromDeck',
      args: {
        player: 'self',
        cardId: '$pick.cardId',
        target: {
          kind: 'pick',
          chooser: 'self',
          n: { min: 1, max: 1 },
          query: { area: 'deck', side: 'self', fromGroupCards: '$revealed' },
        },
      },
    });
    expect(steps[2]).toMatchObject({ verb: 'deckToBottomBound', args: { bindKey: '$revealed' } });
    expect(JSON.parse(JSON.stringify(a1.effect))).toEqual(a1.effect);
  });
});
