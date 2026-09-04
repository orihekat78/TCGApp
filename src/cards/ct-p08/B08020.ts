// cards/ct-p08/B08020 遠山和葉 (character SR) — engine拡張 wave#2 (BUG-132 修正後の再採用)
// rules: rules/05-turn-phases.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から4枚見る。その中から【緑】のイベントを1枚まで公開して手札に加え、
//   残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//   【自分ターン中】【ターン1】自分が【緑】のイベントを使用したとき、AP8000以下のキャラを1枚まで選び、
//   リムーブする。（イベントを解決してからキャラを選ぶ）
// 句マッピング (certify: .tmp/certify/B08020.json verdict:green / 敵対 verify ok):
//   - a1 deck-look-4 → 緑イベント1枚まで手札 → 残りデッキ下 → 加えた場合 discard1
//     = D01013.ts a1 完全同型 (filter に kind:'event' 追加、D01012 が color+kind 組合せの先例)。
//     「1枚まで」=0枚可 (rules/15 + 公式Q&A「加えないことは可能」、TSV qAndA 一次データ)
//     → chooseMatch:'upTo' (BUG-132 GAP-1 decline channel)
//   - a2 「自分が【緑】のイベントを使用したとき」 = B07016.ts a1 完全同型 matcher
//     (effect:declared + kind==='event-use' + engine.cards.get 色判定。カットイン/ヒラメキでは
//     不発動 — payload kind が event-use でないため。公式Q&A で確認済)。filter のみ
//     levelMax:8 → apMax:8000。「（イベントを解決してからキャラを選ぶ）」は BUG-132 GAP-2
//     修正 (declaredBatch gate + 解決時 pick) により公式順で成立。
//     「自分が」は condition turn:self による間接実装 (イベント使用は使用者ターンに限る)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { engine } from '@/engine';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: { color: '緑', kind: 'event' },
          maxN: 4,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', presentation: 'public-selected-card' } },
            { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
          ],
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '【登場時】デッキ上から4枚見る → 【緑】のイベントを1枚まで手札 (取った場合 discard 1) → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【自分ターン中】(「自分が」の side 判定もこの condition が遮蔽 — header 注記)
  condition: { kind: 'turn', player: 'self' },
  // 【ターン1】(0枚選択でも発動済み扱いで消費 — 公式Q&A、rules/24)
  limit: { kind: 'turn', n: 1 },
  // 自分が【緑】のイベントを使用したとき (B07016 a1 同型 matcher)
  trigger: {
    hook: 'effect:declared',
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      const pp = p as { kind?: unknown; cardId?: unknown };
      if (pp.kind !== 'event-use' || typeof pp.cardId !== 'string') return false;
      const d = engine.cards.get(pp.cardId);
      return !!d && d.colors.includes('緑');
    },
  },
  // AP8000以下のキャラを1枚まで選び、リムーブ (イベント解決後の盤面で候補確定 — BUG-132 GAP-2)
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
  description: '【自分ターン中】【ターン1】自分が【緑】のイベントを使用したとき、AP8000以下のキャラを1枚までリムーブ。（イベントを解決してからキャラを選ぶ）',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B08020: CardDef = {
  id: 'B08020',
  no: '0860/B08020',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['高校生'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1770731204429027.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
