// gate5 RUNTIME behavior — B07051 桃井恵子 (character, 白/高校生, L4 AP4000 LP1)
//
// 公式テキスト:
//   【宣言】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが
//     〚カード名［怪盗キッド］〛か〚特徴［高校生］〛のキャラの場合、手札に加える。
//     公開したカードがそれ以外の場合、デッキの下に移す。
//
// rules: 14-refresh.md (公開→加えた時点でリフレッシュ, B07051 Q&A) /
//        15-abilities-effects.md (「〜する」=必須 / chooseMatch 無し forced) /
//        21-declared-ability-cost.md (【宣言】sleepSelf cost は active 時のみ payable) /
//        26-qa-deck-refresh.md (公開中はまだデッキ扱い).
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   canDeclaredAbility('B07051','a1') → activateDeclaredAbility (cost sleepSelf) →
//   useDeclaredAbility が effect:declared を queue → runAllUntilEmpty。
//   deckRevealUntil{maxN:1, chooseMatch 無し} = forced 同期解決 (pick queue 無し)。
//
// 検証する filter (BUG-117/118 lesson: DSL に filterAny を書いても engine が実評価する保証はない):
//   filterAny:[{cardName:'怪盗キッド', kind:'character'}, {trait:'高校生', kind:'character'}]
//   各 filter object 内は AND (cardName/trait + kind すべて満たす)。OR は branch 間。
//   B07051 は B03016 円谷光彦 の文字単位 twin (阿笠博士→怪盗キッド / 少年探偵団→高校生)。
//
// DECOY (filter 実評価を outcome で 1対1 証明 — top に置いて 加えられる/デッキ下 を見る):
//   KID   : cardName 怪盗キッド character        → branch1 match → 手札
//   KOUKOU: 特徴 高校生 character (name≠怪盗)    → branch2 match → 手札
//   SPLIT : 怪盗キッド&黒羽快斗 character         → split-name 成分 怪盗キッド で branch1 match → 手札 (rules/19)
//   KID_EV: cardName 怪盗キッド *event*          → kind:character 違反で **非該当** → デッキ下
//   KOU_EV: 特徴 高校生 *event*                  → kind:character 違反で **非該当** → デッキ下
//   DECOY : 探偵 character (name≠怪盗 / 特徴≠高校生) → 両 branch 非該当 → デッキ下

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../helpers/fixtures';
import { B07051 } from '@/cards/ct-p07/B07051';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

const KID = 'DEC_B07051_KID';          // cardName 怪盗キッド character → match
const KOUKOU = 'DEC_B07051_KOUKOU';    // 特徴 高校生 character → match
const SPLIT = 'DEC_B07051_SPLIT';      // 怪盗キッド&黒羽快斗 character → split-name match
const KID_EV = 'DEC_B07051_KID_EV';    // cardName 怪盗キッド event → 非該当 (kind)
const KOU_EV = 'DEC_B07051_KOU_EV';    // 特徴 高校生 event → 非該当 (kind)
const DECOY = 'DEC_B07051_DECOY';      // 探偵 character → 非該当 (両 branch)

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerDecoys(): void {
  registerCardDef(ch(KID, { names: ['怪盗キッド'], traits: ['怪盗'] }));
  registerCardDef(ch(KOUKOU, { names: ['鈴木園子'], traits: ['高校生'] }));
  registerCardDef(ch(SPLIT, { names: ['怪盗キッド&黒羽快斗'], traits: ['高校生だが特徴別物'] }));
  registerCardDef(ch(KID_EV, { kind: 'event', names: ['怪盗キッド'], traits: [] }));
  registerCardDef(ch(KOU_EV, { kind: 'event', names: ['イベント'], traits: ['高校生'] }));
  registerCardDef(ch(DECOY, { names: ['灰原哀'], traits: ['探偵'] }));
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);
const deckBottom = (s: GameState) => s.players.self.deck[s.players.self.deck.length - 1];
const selfState = (s: GameState) => s.players.self.scene.find((c) => c.uid === 'momo#1')?.state;

// B07051 を active で現場に置き、deck をセットした base。
function base(deck: string[], srcState: 'active' | 'sleep' = 'active'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [sceneChar('B07051', 'momo#1', { state: srcState })];
  s.players.self.deck = [...deck];
  return s;
}

function run(deck: string[]): GameState {
  let s = base(deck);
  s = produce(s, (d) => {
    activateDeclaredAbility(d, 'momo#1', 'a1'); // cost: sleepSelf / effect queue
    runAllUntilEmpty(d);                        // deckRevealUntil forced (pick 無し)
  });
  return s;
}

describe('B07051 桃井恵子 — gate5 runtime behavior (deckReveal filterAny → hand / deck-bottom)', () => {
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
  // MATCH branches → 手札に加える (top に 1 枚、下に decoy フィラー)
  // ============================================================
  it('branch1 cardName[怪盗キッド] が top → 手札に加える / 自身スリープ', () => {
    const s = run([KID, DECOY]); // top=KID (match)
    expect(inHand(s, KID), 'KID は手札へ').toBe(true);
    expect(inDeck(s, KID), 'KID は deck から抜けた').toBe(false);
    expect(inDeck(s, DECOY), '未公開の DECOY は deck に残る').toBe(true);
    expect(selfState(s), 'cost: 自身スリープ').toBe('sleep');
  });

  it('branch2 特徴[高校生] が top → 手札に加える', () => {
    const s = run([KOUKOU, DECOY]);
    expect(inHand(s, KOUKOU), '高校生 character は手札へ').toBe(true);
    expect(inDeck(s, KOUKOU), 'deck から抜けた').toBe(false);
  });

  it('split-name 怪盗キッド&黒羽快斗 が top → 成分 怪盗キッド で branch1 match → 手札 (rules/19)', () => {
    const s = run([SPLIT, DECOY]);
    expect(inHand(s, SPLIT), 'split-name 成分 怪盗キッド で match → 手札').toBe(true);
  });

  // ============================================================
  // NON-match → デッキの下に移す (kind:character 違反 / 両 branch 非該当)
  // ============================================================
  it('DECOY 探偵character (両 branch 非該当) が top → 手札に加えず デッキ下', () => {
    const s = run([DECOY, KID]); // top=DECOY (non-match)。KID は未公開 (top1 のみ reveal)
    expect(inHand(s, DECOY), 'DECOY は手札に入らない').toBe(false);
    expect(inDeck(s, DECOY), 'DECOY は deck に残る (下へ)').toBe(true);
    expect(deckBottom(s), 'DECOY が deck 最下部へ移動').toBe(DECOY);
    expect(inHand(s, KID), '未公開の KID は手札に入らない (top1 のみ公開)').toBe(false);
    expect(deckBottom(s) !== KID, 'KID は最下部ではない (元位置のまま=現 top)').toBe(true);
  });

  it('KID_EV 怪盗キッド *event* が top → kind:character 違反で 非該当 → デッキ下 (手札に入らない)', () => {
    const s = run([KID_EV, DECOY]);
    expect(inHand(s, KID_EV), 'event は kind:character 違反で手札に入らない').toBe(false);
    expect(deckBottom(s), 'KID_EV は deck 最下部へ').toBe(KID_EV);
  });

  it('KOU_EV 高校生 *event* が top → kind:character 違反で 非該当 → デッキ下', () => {
    const s = run([KOU_EV, DECOY]);
    expect(inHand(s, KOU_EV), '高校生 event は手札に入らない').toBe(false);
    expect(deckBottom(s), 'KOU_EV は deck 最下部へ').toBe(KOU_EV);
  });

  // ============================================================
  // 宣言ゲート (rules/21: sleepSelf cost は active 時のみ payable)
  //   canDeclaredAbility は存在/limit/condition のみ判定 (cost gate は別 = engine.cost.canPay、
  //   docstring「active でなくても OK / sleep コストは別途 canPay 判定が必要」)。
  // ============================================================
  it('canDeclaredAbility: 対象キャラ存在で宣言可 (cost gate は別)', () => {
    const active = base([KID], 'active');
    expect(canDeclaredAbility(active, 'momo#1', 'a1'), '対象存在 → 宣言可 (limit/condition 無し)').toBe(true);
    expect(canDeclaredAbility(active, 'nonexist#9', 'a1'), '不在 uid → false').toBe(false);
  });

  it('cost gate: sleepSelf は active のみ payable (rules/21 sleep/stun は支払不可)', () => {
    const active = base([KID], 'active');
    const sleeping = base([KID], 'sleep');
    const a1 = B07051.abilities.find((a) => a.id === 'a1')!;
    const ctx: EffectCtx = {
      source: { cardId: 'B07051', uid: 'momo#1', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    expect(engineCost.canPay(sleeping, a1.cost!, ctx), 'sleep → sleepSelf cost 払えず canPay=false').toBe(false);
    expect(engineCost.canPay(active, a1.cost!, ctx), 'active → canPay=true').toBe(true);
  });

  // ============================================================
  // descriptor 構造 sanity (出荷 AbilityDef の filter 値を直接 pin)
  // ============================================================
  it('descriptor: a1=declared, cost=sleepSelf, deckRevealUntil{maxN:1, filterAny[怪盗キッド|高校生 × character]}, handAddFromDeck, deckToBottomBound', () => {
    const a1 = B07051.abilities.find((a) => a.id === 'a1')!;
    expect(a1.type).toBe('declared');
    expect(a1.cost).toMatchObject({ kind: 'sleepSelf' });
    expect(a1.effect).toMatchObject({
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'deckRevealUntil',
          args: {
            player: 'self',
            maxN: 1,
            filterAny: [
              { cardName: '怪盗キッド', kind: 'character' },
              { trait: '高校生', kind: 'character' },
            ],
            bind: '$revealed',
            bindMatch: '$matched',
          },
        },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$matched', presence: 'matched' },
          then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
        },
        { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      ],
    });
    // chooseMatch 無し = forced (「〜する」必須, rules/15)
    const revealArgs = (a1.effect as { steps: { args?: Record<string, unknown> }[] }).steps[0]!.args!;
    expect(revealArgs.chooseMatch, 'chooseMatch 無し = forced 型 (decline pick 無し)').toBeUndefined();
  });
});
