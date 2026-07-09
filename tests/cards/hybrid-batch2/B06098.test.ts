// hybrid-batch2 probe — B06098 ベルモット＆シェリー (character / MR / 黒 / 黒ずくめの組織)
//
// 公式テキスト (refusedLine = a2 novel句 — compiler は a1 sceneRemove / a3 カットイン のみ compile):
//   【宣言】【ターン1】自分のデッキのカードを上から3枚見る。その中から【カットイン】を持つレベル8以下の
//   【黒】のカードを1枚まで公開して手札に加え、残りをリムーブエリアに移す。レベル4以上のカードを手札に
//   加えた場合、手札を1枚リムーブする。この能力は自分の現場に〚特徴［黒ずくめの組織］〛のキャラが2枚以上
//   いる場合に宣言できる。この能力はパートナーエリアでも宣言できる。
//
// novel 経路 (B06043 恋と推理の剣道大会 / B07051 桃井恵子 の親戚):
//   scope on-partner-area declared (uid='partnerMR:self') / condition sceneHas 黒ずくめ 2枚以上 /
//   effect sequence[
//     deckRevealUntil{maxN:3, chooseMatch:'upTo', filter{keyword:カットイン, levelMax:8, color:黒}, bind $revealed, bindMatch $matched},
//     conditional{ if $matched matched → handAddFromDeck $matched.cardId },
//     boundToRemove $revealed,                                  ← B06043 は deckToBottomBound / 本カードは remove へ (差分)
//     conditional{ if boundMatchesFilter $matched levelMin:4 → discard n:1 } ← レベル4以上を加えた場合のみ手札1リムーブ (novel)
//   ]
//
// 検証面 (BUG-117/118: DSL に filter/条件を書いても engine が実評価する保証はない → outcome で 1対1 証明):
//   - filter 3軸 (keyword:カットイン / color:黒 / levelMax:8) を decoy で個別に外す
//   - maxN:3 の window (position-4 の match は公開されない)
//   - boundToRemove は「残りをリムーブエリアへ」(deck 下ではない)
//   - 後段 conditional discard は matched.level>=4 のときのみ発火
//   - PA-MR 自身は【黒ずくめ】計数に含めない (公式Q&A: PA にいる場合は数えない)
//
// production dispatch: activateDeclaredAbility('partnerMR:self','a2') + runAllUntilEmpty (BUG-171、cost 無し)。
//   AI 経路 = chooseMatch:'upTo' が human 不在で先頭 match を自動取得 (pick surface しない)。discard の
//   短縮形 pick は drainAiEffectPicks で解決。
// human pick: _drainPendingEffectPickSide → applyPickAndContinuation(take) / applyPickSkipAndContinuation(decline)。
// BUG-174 owner='opp' pin: B06098 を opp の PA-MR に置き setHuman('opp') → opp の deck/hand/remove 側で解決。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import {
  _drainPendingEffectPickSide,
  _peekPendingEffectPickQueueLength,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar, makeChar } from '../../helpers/fixtures';
import { B06098 } from '@/cards/ct-p06/B06098';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

// --- fixtures (DEC_ prefix で実カードと非衝突) ---
const KURO = 'DEC_B06098_KURO';         // 特徴[黒ずくめの組織] character — condition 計数
const OTHER = 'DEC_B06098_OTHER';       // 特徴なし character — condition 非計数 decoy
const MATCH_L3 = 'DEC_B06098_M_L3';     // カットイン / 黒 / lv3 → match, discard なし
const MATCH_L4 = 'DEC_B06098_M_L4';     // カットイン / 黒 / lv4 → match, discard あり
const DK_NOCUT = 'DEC_B06098_NOCUT';    // 非カットイン / 黒 / lv3 → keyword 外
const DK_WHITE = 'DEC_B06098_WHITE';    // カットイン / 白 / lv3 → color 外
const DK_L9 = 'DEC_B06098_L9';          // カットイン / 黒 / lv9 → levelMax 外
const FILL = 'DEC_B06098_FILL';         // 非マッチ フィラー (赤/lv3/非カットイン)
const HND1 = 'DEC_B06098_HND1';         // 手札フィラー
const HND2 = 'DEC_B06098_HND2';

// 【カットイン】= abilityIsCutin (read/keyword.ts): type:triggered + scope:on-hand +
// trigger{hook:'effect:declared', optional:true}。effect 内容は keyword 判定に無関係。
const cutin: AbilityDef = {
  id: 'c', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, scope: 'contact', uid: '$contact.byUid' } },
  description: '【カットイン】AP＋2000',
};

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerFixtures(): void {
  registerCardDef(B06098);
  registerCardDef(ch(KURO, { traits: ['黒ずくめの組織'] }));
  registerCardDef(ch(OTHER, { traits: ['探偵'] }));
  registerCardDef(ch(MATCH_L3, { colors: ['黒'], level: 3, abilities: [cutin] }));
  registerCardDef(ch(MATCH_L4, { colors: ['黒'], level: 4, abilities: [cutin] }));
  registerCardDef(ch(DK_NOCUT, { colors: ['黒'], level: 3, abilities: [] }));
  registerCardDef(ch(DK_WHITE, { colors: ['白'], level: 3, abilities: [cutin] }));
  registerCardDef(ch(DK_L9, { colors: ['黒'], level: 9, abilities: [cutin] }));
  registerCardDef(ch(FILL));
  registerCardDef(ch(HND1));
  registerCardDef(ch(HND2));
}

const setHuman = (s: 'self' | 'opp' | null) =>
  { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
const paUid = (side: 'self' | 'opp') => `partnerMR:${side}`;

// B06098 を side の PA-MR に置き、self 現場に黒ずくめ2枚 (condition) + deck/hand をセットした base。
function base(opts: {
  side?: 'self' | 'opp';
  kuro?: number;          // 現場の黒ずくめ枚数 (condition)
  extraOther?: boolean;   // 特徴なし decoy を 1 枚 (非計数証明)
  deck?: string[];
  hand?: string[];
} = {}): GameState {
  const side = opts.side ?? 'self';
  const s = createEmptyGameState();
  s.turn = { number: 5, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const p = s.players[side];
  p.partnerAreaMR = makeChar({ cardId: 'B06098', uid: paUid(side) });
  const kuroN = opts.kuro ?? 2;
  p.scene = Array.from({ length: kuroN }, (_, i) => sceneChar(KURO, `k${i}`));
  if (opts.extraOther) p.scene.push(sceneChar(OTHER, 'oth'));
  p.deck = opts.deck ?? [MATCH_L3, FILL, FILL, 'TAIL1', 'TAIL2'];
  p.hand = opts.hand ?? [];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  registerFixtures();
  registerTriggeredListener();
});

// ============================================================
// condition gate — sceneHas 特徴[黒ずくめの組織] 2枚以上 (PA-MR 自身は非計数, 公式Q&A)
// ============================================================
describe('B06098 a2 — condition sceneHas 黒ずくめ 2枚以上 (PA-MR は数えない)', () => {
  it('現場に黒ずくめ2枚 → 宣言可', () => {
    expect(canDeclaredAbility(base({ kuro: 2 }), paUid('self'), 'a2')).toBe(true);
  });
  it('現場に黒ずくめ1枚のみ (PA の B06098 は数えない) → 宣言不可', () => {
    expect(canDeclaredAbility(base({ kuro: 1 }), paUid('self'), 'a2')).toBe(false);
  });
  it('黒ずくめ1枚 + 特徴なし1枚 → 特徴なしは計数外なので宣言不可', () => {
    expect(canDeclaredAbility(base({ kuro: 1, extraOther: true }), paUid('self'), 'a2')).toBe(false);
  });
});

// ============================================================
// AI auto-take path — deckRevealUntil(keyword:カットイン, levelMax:8, color:黒) + boundToRemove + discard
// ============================================================
describe('B06098 a2 — deckRevealUntil filter + boundToRemove + level>=4 discard (AI auto)', () => {
  const activate = (s0: GameState, side: 'self' | 'opp' = 'self') => produce(s0, (d) => {
    activateDeclaredAbility(d, paUid(side), 'a2');
    runAllUntilEmpty(d);
    // discard の短縮形 pick (level>=4 分岐) を AI 解決
    for (let i = 0; i < 3; i++) {
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    }
  });

  it('MATCH_L3 が top → 手札へ + 残り2枚は remove エリア (deck 下ではない) / discard なし', () => {
    const after = activate(base({ deck: [MATCH_L3, FILL, FILL, 'TAIL1', 'TAIL2'], hand: [HND1, HND2] }));
    expect(after.players.self.hand.includes(MATCH_L3), 'MATCH_L3 → 手札').toBe(true);
    expect(after.players.self.hand.length, 'lv3 は discard なし → 手札 +1').toBe(3);
    expect(after.players.self.deck.includes(MATCH_L3), 'MATCH は deck から抜けた').toBe(false);
    expect(after.players.self.remove.filter((c) => c === FILL).length, '残り2枚(FILL)は remove へ').toBe(2);
    expect(after.players.self.deck.includes(FILL), '残りは deck 下ではなく remove (deck に残らない)').toBe(false);
    expect(after.players.self.deck, 'deck は tail のみ残る').toEqual(['TAIL1', 'TAIL2']);
    expect(_peekPendingEffectPickQueueLength(), 'AI 経路: reveal pick は surface しない').toBe(0);
  });

  it('MATCH_L4 が top → 手札へ + level>=4 で手札1リムーブ (net 手札不変 / remove は残2+捨1=3)', () => {
    const after = activate(base({ deck: [MATCH_L4, FILL, FILL, 'TAIL1', 'TAIL2'], hand: [HND1, HND2] }));
    expect(after.players.self.hand.length, 'lv4 加える → discard 1 で net ±0 (初期2)').toBe(2);
    expect(after.players.self.remove.length, 'remove = 残り2(FILL) + discard1 = 3').toBe(3);
  });

  it('MATCH_L3 (lv3) は discard 分岐に入らない — L4 との remove 枚数差で discard 発火を証明', () => {
    const l3 = activate(base({ deck: [MATCH_L3, FILL, FILL, 'TAIL1', 'TAIL2'], hand: [HND1, HND2] }));
    const l4 = activate(base({ deck: [MATCH_L4, FILL, FILL, 'TAIL1', 'TAIL2'], hand: [HND1, HND2] }));
    expect(l3.players.self.remove.length, 'lv3: 残り2枚のみ').toBe(2);
    expect(l4.players.self.remove.length, 'lv4: 残り2 + discard1').toBe(3);
  });

  it('【ターン1】: 宣言後 canDeclaredAbility=false (2回目不可)', () => {
    const after = activate(base());
    expect(canDeclaredAbility(after, paUid('self'), 'a2')).toBe(false);
  });
});

// ============================================================
// filter decoy — keyword:カットイン / color:黒 / levelMax:8 を個別に外す (BUG-117/118)
// ============================================================
describe('B06098 a2 — filter 3軸 decoy は match されず remove へ (hand に入らない)', () => {
  const activate = (s0: GameState) => produce(s0, (d) => {
    activateDeclaredAbility(d, paUid('self'), 'a2');
    runAllUntilEmpty(d);
  });
  const rows: Array<[string, string]> = [
    ['非カットイン (keyword 外)', DK_NOCUT],
    ['白 (color 外)', DK_WHITE],
    ['レベル9 (levelMax:8 外)', DK_L9],
  ];
  it.each(rows)('%s が top3 → 手札に加えず remove へ', (_label, decoy) => {
    const after = activate(base({ deck: [decoy, FILL, FILL, 'TAIL1', 'TAIL2'] }));
    expect(after.players.self.hand.includes(decoy), 'decoy は match 外 → 手札に入らない').toBe(false);
    expect(after.players.self.hand.length, '手札加算なし').toBe(0);
    expect(after.players.self.remove.includes(decoy), 'decoy は残りとして remove へ').toBe(true);
    expect(after.players.self.remove.length, '公開3枚すべて remove').toBe(3);
  });
});

// ============================================================
// maxN:3 window — position-4 の match は公開されず deck に残る
// ============================================================
describe('B06098 a2 — maxN:3 window (top3 のみ公開)', () => {
  it('MATCH_L3 が deck 4番目 → top3 は非マッチ → 加算なし / MATCH は deck に残る', () => {
    const after = produce(base({ deck: [FILL, FILL, FILL, MATCH_L3, 'TAIL'] }), (d) => {
      activateDeclaredAbility(d, paUid('self'), 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.includes(MATCH_L3), '4番目の match は公開範囲外 → 手札に入らない').toBe(false);
    expect(after.players.self.hand.length).toBe(0);
    expect(after.players.self.deck.includes(MATCH_L3), 'MATCH_L3 は deck に残る').toBe(true);
    expect(after.players.self.remove.filter((c) => c === FILL).length, 'top3 の FILL のみ remove').toBe(3);
  });
});

// ============================================================
// human pick 経路 — chooseMatch:'upTo' (owner が human のとき pick surface)
// ============================================================
describe('B06098 a2 — chooseMatch:upTo human pick (decline / owner=opp take)', () => {
  it('human self: match ありでも decline → 手札に加えず全公開を remove (rules/15 「まで」/ B08020 Q&A)', () => {
    setHuman('self');
    const after = produce(base({ deck: [MATCH_L3, FILL, FILL, 'TAIL1', 'TAIL2'] }), (d) => {
      activateDeclaredAbility(d, paUid('self'), 'a2');
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'human owner → reveal pick surface').not.toBeNull();
      expect(pending!.nMin, '「1枚まで」→ 0枚可 (decline 可)').toBe(0);
      applyPickSkipAndContinuation(d, pending!); // decline (加えない)
    });
    expect(after.players.self.hand.includes(MATCH_L3), 'decline → 手札に加えない').toBe(false);
    expect(after.players.self.hand.length, 'decline → 手札 0 (B08020: 加えなければ discard もなし)').toBe(0);
    expect(after.players.self.remove.includes(MATCH_L3), '加えなかった MATCH も残りとして remove へ').toBe(true);
    expect(after.players.self.remove.length, '公開3枚すべて remove').toBe(3);
  });

  it('owner=opp (B06098 が opp PA-MR / human opp) take → opp の hand/remove 側で解決 / self 無影響 (BUG-174)', () => {
    setHuman('opp');
    const after = produce(base({ side: 'opp', deck: [MATCH_L3, FILL, FILL, 'TAIL1', 'TAIL2'] }), (d) => {
      activateDeclaredAbility(d, paUid('opp'), 'a2');
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'opp owner human → pick surface').not.toBeNull();
      expect(pending!.player, 'chooser = opp').toBe('opp');
      const cand = pending!.candidates.find((c) => c.cardId === MATCH_L3);
      expect(cand, 'MATCH_L3 が候補').toBeTruthy();
      applyPickAndContinuation(d, pending!, cand!.uid); // take
    });
    expect(after.players.opp.hand.includes(MATCH_L3), '相手の手札に MATCH_L3').toBe(true);
    expect(after.players.opp.remove.filter((c) => c === FILL).length, '相手 remove: 残り2枚(FILL)').toBe(2);
    expect(after.players.self.hand.length, '自分側は無影響').toBe(0);
    expect(after.players.self.remove.length, '自分側 remove 無影響').toBe(0);
  });
});
