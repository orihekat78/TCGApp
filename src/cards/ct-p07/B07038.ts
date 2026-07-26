// cards/ct-p07/B07038 紅子の執事 (character) — 赤魔術 trait family残 (engine変更0, 手書き closure filter)
// rules: 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 22-qa-action-contact.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から〚カード名［小泉紅子］〛か、〚特徴［赤魔術］〛のイベントが出るまで
//     1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//     カードを手札に加えた場合、手札を1枚リムーブする。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
// 公式Q&A:
//   - 該当が見つからずデッキ全公開 → 何も加えず全部デッキに戻してシャッフル。この場合手札リムーブしない。
//   - 該当が公開されたとき、それを手札に加えないことはできない (必ず最初の該当を加える=forced)。
//
// 句マッピング (certify: equivalent / high — import 元のみ corrections 反映):
//   - a1 【登場時】reveal-until(名前小泉紅子 OR 赤魔術event) → handAdd → 残りデッキ下 → shuffle → (加えた場合) discard 1
//     = B07052 a2 (forced reveal-until) の filter を closure-OR に変更 + 末尾 conditional discard 追加。
//     · closure filter: deckRevealUntil は a.filter に function(cardId)=>boolean を受理 (atom-handlers.ts:1264-1267)。
//       「カード名[小泉紅子]」= allCardNameComponentsForDef に '小泉紅子' を含む (kind不問, rules/19 分割名)。
//       「特徴[赤魔術]のイベント」= kind==='event' && traits.includes('赤魔術')。両者 OR。
//       import 元は card-def-registry.js (barrel @/engine/target は lookupCardDef を re-export しない。B09017 同 import 先例)。
//     · forced add = chooseMatch 無し → $matched を必ず加える (公式Q&A)。$matched=null (全公開不在) なら add も discard も skip。
//     · 「加えた場合、手札1リムーブ」= conditional($matched matched){ discard n:1 } (rules/15 そうした場合 / D01003 discard)。
//   - a2 【カットイン】AP＋1000 = $contact.byUid を contact scope で +1000 (D01009/B07009 同型 cutin)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { lookupCardDef, allCardNameComponentsForDef } from '@/engine/target/card-def-registry.js';

// a1: 【登場時】[小泉紅子] か [赤魔術]event が出るまで公開→手札→残りデッキ下→シャッフル→(加えたら) 手札1リムーブ。
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
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          // 〚カード名［小泉紅子］〛(kind不問) か 〚特徴［赤魔術］〛のイベントが出るまで (deckRevealUntil は function filter 受理)
          filter: (cardId: string): boolean => {
            const d = lookupCardDef(cardId);
            if (!d) return false;
            return allCardNameComponentsForDef(d, 'deck').includes('小泉紅子') || (d.kind === 'event' && d.traits.includes('赤魔術'));
          },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      // それを手札に加える (該当が出れば必ず加える=forced)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      // 残りの公開したカードをデッキの下に移し、デッキをシャッフルする
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
      // カードを手札に加えた場合、手札を1枚リムーブする
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】デッキ上から〚カード名［小泉紅子］〛か〚特徴［赤魔術］〛のイベントが出るまで公開し手札に加える。残りをデッキ下に移しシャッフル。加えた場合、手札を1枚リムーブ。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};

// a2: 【カットイン】AP＋1000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算 (D01009/B07009 同型)。
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B07038: CardDef = {
  id: 'B07038',
  no: '0767/B07038',
  kind: 'character',
  names: ['紅子の執事'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 0,
  traits: ['執事'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413994250288.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
