// wave-deckLook-bottom — B05078 世良真純 / B03056 千間降代 を実 engine 経路で駆動する挙動テスト。
// 既存 verb (deckRevealUntil{maxN,chooseMatch:'upTo'} / handAddFromDeck / deckToBottomBound /
//   sceneRemove{uid:'$self'} / evidenceGain) のみで実装 = engine変更0。
// BUG-117/118 lesson: DSL に filter/filterAny を書いても engine が実評価する保証はないため、
//   decoy を盤面/デッキに置いて outcome で 1対1 検証する。
// rules: 03/05/10/11/14/15/17/26 + TSV qAndA (B05078 / B03056)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { evalCond } from '@/engine/cond/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { registerAll } from '@/cards/index';
import { makeChar } from '../helpers/fixtures';
import { B05078 } from '@/cards/ct-p05/B05078';
import { B03056 } from '@/cards/ct-p03/B03056';
import type { CardDef, GameState, EffectCtx, Condition } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// deck-look decoys
const AKAI = 'DEC_AKAI';      // 特徴 赤井家 character → match (branch1)
const TANTEI = 'DEC_TANTEI';  // 特徴 探偵 character    → match (branch2)
const AKAI_EV = 'DEC_AKAI_EV';// 特徴 赤井家 *event*    → 非該当 (kind:character 違反)
const OTHER = 'DEC_OTHER';    // 特徴 警察 character     → 非該当 (両 branch)
const FILL1 = 'FILL1', FILL2 = 'FILL2', FILL3 = 'FILL3';

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);
const deckBottom = (s: GameState) => s.players.self.deck[s.players.self.deck.length - 1];

function registerDecoys(): void {
  registerCardDef(ch(AKAI, { names: ['赤井秀一'], traits: ['赤井家'] }));
  registerCardDef(ch(TANTEI, { names: ['工藤新一'], traits: ['探偵'] }));
  registerCardDef(ch(AKAI_EV, { kind: 'event', names: ['赤井のイベント'], traits: ['赤井家'] }));
  registerCardDef(ch(OTHER, { names: ['佐藤刑事'], traits: ['警察'] }));
  registerCardDef(ch(FILL1, { traits: ['警察'] }));
  registerCardDef(ch(FILL2, { traits: ['警察'] }));
  registerCardDef(ch(FILL3, { traits: ['警察'] }));
}

function baseTurn5(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerDecoys();
  registerTriggeredListener();
});

// emit 登場時 + 効果解決 + pick drain (discard 等の PA pick を AI で解決)
function fireEnter(s: GameState, uid: string, cardId: string): GameState {
  let after = produce(s, (d) => {
    event.emit(d, 'enter', { uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId, uid });
    runAllUntilEmpty(d);
  });
  after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
  return after;
}

// ============================================================
// B05078 世良真純 — a1 deck-look-4 filterAny[赤井家|探偵 × character] + 加えたら discard1
// ============================================================
describe('B05078 a1: 登場時 上から4枚見て(赤井家|探偵)キャラ1枚まで手札→残りデッキ下→加えたら手札1リムーブ', () => {
  it('赤井家 character が top → 手札へ (branch1 match) / 残り3枚デッキ下 / discard 発生', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'sera#1', cardId: 'B05078', state: 'active' })];
    s.players.self.deck = [AKAI, FILL1, FILL2, FILL3, OTHER]; // 上4=AKAI,FILL1,FILL2,FILL3
    s.players.self.hand = ['HAND_SEED'];
    const after = fireEnter(s, 'sera#1', 'B05078');
    expect(inHand(after, AKAI), '赤井家キャラは手札へ').toBe(true);
    expect(inDeck(after, AKAI), 'deck から抜けた').toBe(false);
    // 加えた場合 手札1リムーブ: seed(1) + take(1) - discard(1) = 1
    expect(after.players.self.hand.length, '取得後 discard1 で手札枚数 net 0').toBe(1);
    // 残り (FILL1-3) はデッキ下、未公開 OTHER は元位置
    expect(inDeck(after, FILL1) && inDeck(after, FILL2) && inDeck(after, FILL3), '残り3枚 deck に残る').toBe(true);
  });

  it('探偵 character が top → 手札へ (branch2 match)', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'sera#1', cardId: 'B05078', state: 'active' })];
    s.players.self.deck = [TANTEI, FILL1, FILL2, FILL3];
    s.players.self.hand = ['HAND_SEED']; // discard 先を seed に逃がし、match の手札着地を観測
    const after = fireEnter(s, 'sera#1', 'B05078');
    expect(inDeck(after, TANTEI), '探偵キャラは deck から抜けた (branch2 match)').toBe(false);
    expect(inHand(after, TANTEI), '探偵キャラは手札へ (discard は seed を捨て character を残す)').toBe(true);
  });

  it('赤井家 *event* が窓内 → kind:character 違反で 非該当 → 手札に入らず全部デッキ下 / discard なし', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'sera#1', cardId: 'B05078', state: 'active' })];
    s.players.self.deck = [AKAI_EV, FILL1, FILL2, FILL3];
    s.players.self.hand = ['HAND_SEED'];
    const after = fireEnter(s, 'sera#1', 'B05078');
    expect(inHand(after, AKAI_EV), '赤井家 event は kind 違反で手札に入らない').toBe(false);
    expect(inDeck(after, AKAI_EV), 'event は deck に残る (下へ)').toBe(true);
    expect(after.players.self.hand.length, '取得なし → discard なし → seed のみ').toBe(1);
  });

  it('警察 character のみ (両 branch 非該当) → 手札に入らず全部デッキ下', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'sera#1', cardId: 'B05078', state: 'active' })];
    s.players.self.deck = [OTHER, FILL1, FILL2, FILL3];
    const after = fireEnter(s, 'sera#1', 'B05078');
    expect(inHand(after, OTHER), '警察キャラは非該当').toBe(false);
    expect(deckBottom(after), '非match の窓カードがデッキ下へ (最下=窓末尾 FILL3)').toBe(FILL3);
  });
});

describe('B05078 descriptor pin', () => {
  it('a1=enter, deckRevealUntil{maxN:4,chooseMatch:upTo,filterAny[赤井家|探偵×character]} → cond[handAdd→discard] → deckToBottomBound', () => {
    const a1 = B05078.abilities.find((a) => a.id === 'a1')!;
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.effect).toMatchObject({
      kind: 'sequence',
      steps: [
        {
          verb: 'deckRevealUntil',
          args: {
            chooseMatch: 'upTo', maxN: 4,
            filterAny: [{ trait: '赤井家', kind: 'character' }, { trait: '探偵', kind: 'character' }],
            bind: '$revealed', bindMatch: '$matched',
          },
        },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$matched', presence: 'matched' },
          then: { kind: 'sequence', steps: [
            { verb: 'handAddFromDeck', args: { cardId: '$matched.cardId' } },
            { verb: 'discard', args: { n: 1 } },
          ] },
        },
        { verb: 'deckToBottomBound', args: { bindKey: '$revealed' } },
      ],
    });
  });
  it('a2=ヒラメキ (evidence:remove-by-action optional → draw1)', () => {
    const a2 = B05078.abilities.find((a) => a.id === 'a2')!;
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
  });
});

// ============================================================
// B03056 千間降代 — a1 deck-look-1 探偵 / a2 turn-end 探偵sleep≥3 → self-remove → evidence
// ============================================================
describe('B03056 a1: 登場時 上から1枚見て探偵キャラ1枚まで手札→残りデッキ下', () => {
  it('探偵 character が top → 手札へ', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'sen#1', cardId: 'B03056', state: 'active' })];
    s.players.self.deck = [TANTEI, FILL1];
    const after = fireEnter(s, 'sen#1', 'B03056');
    expect(inHand(after, TANTEI), '探偵は手札へ').toBe(true);
    expect(inDeck(after, FILL1), '未公開 FILL1 は deck に残る').toBe(true);
  });
  it('非探偵 (警察) が top → 手札に入らず デッキ下', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'sen#1', cardId: 'B03056', state: 'active' })];
    s.players.self.deck = [OTHER, FILL1];
    const after = fireEnter(s, 'sen#1', 'B03056');
    expect(inHand(after, OTHER), '警察は非該当').toBe(false);
    expect(deckBottom(after), 'OTHER がデッキ下へ').toBe(OTHER);
  });
});

describe('B03056 a2 condition: 自分の現場の 探偵 スリープ≥3 のみ成立 (active/他特徴は計数しない)', () => {
  const a2cond = (): Condition => B03056.abilities.find((a) => a.id === 'a2')!.condition!;
  const ctx: EffectCtx = { source: { cardId: 'B03056', uid: 'sen#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };

  function withScene(chars: { uid: string; cardId: string; state: 'active' | 'sleep' }[]): GameState {
    const s = baseTurn5();
    s.players.self.scene = chars.map((c) => makeChar({ uid: c.uid, cardId: c.cardId, state: c.state }));
    return s;
  }

  it('探偵 スリープ 3枚 → true', () => {
    const s = withScene([
      { uid: 'sen#1', cardId: 'B03056', state: 'sleep' }, // 自身も探偵 (計数)
      { uid: 't2', cardId: TANTEI, state: 'sleep' },
      { uid: 't3', cardId: TANTEI, state: 'sleep' },
    ]);
    expect(evalCond(s, a2cond(), ctx)).toBe(true);
  });
  it('探偵 スリープ 2枚 → false (3枚未満)', () => {
    const s = withScene([
      { uid: 't1', cardId: TANTEI, state: 'sleep' },
      { uid: 't2', cardId: TANTEI, state: 'sleep' },
    ]);
    expect(evalCond(s, a2cond(), ctx)).toBe(false);
  });
  it('探偵 active 3枚 → false (スリープのみ計数)', () => {
    const s = withScene([
      { uid: 't1', cardId: TANTEI, state: 'active' },
      { uid: 't2', cardId: TANTEI, state: 'active' },
      { uid: 't3', cardId: TANTEI, state: 'active' },
    ]);
    expect(evalCond(s, a2cond(), ctx)).toBe(false);
  });
  it('警察 スリープ 3枚 → false (探偵特徴のみ計数)', () => {
    const s = withScene([
      { uid: 'o1', cardId: OTHER, state: 'sleep' },
      { uid: 'o2', cardId: OTHER, state: 'sleep' },
      { uid: 'o3', cardId: OTHER, state: 'sleep' },
    ]);
    expect(evalCond(s, a2cond(), ctx)).toBe(false);
  });
  it('相手のターン中 → false (turn:self gate)', () => {
    const s = withScene([
      { uid: 'sen#1', cardId: 'B03056', state: 'sleep' },
      { uid: 't2', cardId: TANTEI, state: 'sleep' },
      { uid: 't3', cardId: TANTEI, state: 'sleep' },
    ]);
    s.turn = { ...s.turn, player: 'opp' };
    expect(evalCond(s, a2cond(), ctx)).toBe(false);
  });
});

describe('B03056 a2 effect: このキャラをリムーブしてもよい→証拠1 (opt-in / opt-out)', () => {
  const a2eff = () => B03056.abilities.find((a) => a.id === 'a2')!.effect!;

  function withSelf(): GameState {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'sen#1', cardId: 'B03056', state: 'sleep' })];
    s.players.self.deck = ['ev1', 'ev2']; // evidenceGain は deck から取る
    return s;
  }

  it('opt-in (optionalRun:true): 自身が現場を離れ + 証拠+1', () => {
    const s = withSelf();
    const ctx: EffectCtx = { source: { cardId: 'B03056', uid: 'sen#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {}, dyn: { optionalRun: true } };
    const after = produce(s, (d) => runEffect(d, a2eff(), ctx));
    expect(after.players.self.scene.find((c) => c.uid === 'sen#1'), '自身がリムーブされ現場から消える').toBeUndefined();
    expect(after.players.self.remove, '自身はリムーブエリアへ').toContain('B03056');
    expect(after.players.self.evidence.length, '証拠+1').toBe(1);
  });

  it('opt-out (optionalRun:false): 何も起きない (自身残留 / 証拠なし)', () => {
    const s = withSelf();
    const ctx: EffectCtx = { source: { cardId: 'B03056', uid: 'sen#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {}, dyn: { optionalRun: false } };
    const after = produce(s, (d) => runEffect(d, a2eff(), ctx));
    expect(after.players.self.scene.find((c) => c.uid === 'sen#1'), '自身は現場に残る').toBeDefined();
    expect(after.players.self.evidence.length, '証拠は得ない').toBe(0);
  });
});
