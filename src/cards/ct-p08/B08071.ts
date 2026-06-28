// cards/ct-p08/B08071 佐藤正義 (character) — engine変更0 wave (triage-verify, 2026-06-28)
// rules: rules/09-cutin-disguise.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   【宣言】〚リムーブエリアに移す〛：自分のデッキのカードを上から4枚見る。その中から〚カード名［佐藤美和子］〛を
//     1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   【カットイン】AP＋1000、〚カード名［佐藤美和子］〛に【カットイン】した場合、カードを1枚引く。（コンタクト中に手札からリムーブして使う）
//
// 句マッピング (verified twin = PR194/B04009 cost / B08075 opt3・B05016 deck-look / B06041 additive cutin):
//   - a1 【宣言】〚リムーブエリアに移す〛(対象省略=このキャラ自身, rules/21) = cost{kind:'removeFromScene', target:{kind:'self'}, n:1} (PR194 a1 同型)。
//     「デッキ上4枚見て〚佐藤美和子〛を1枚まで公開手札, 残りデッキ下」= deckRevealUntil{chooseMatch:'upTo'(1枚まで=0可),
//       maxN:4, filter:{cardName:'佐藤美和子', kind:'character'}} → conditional(bound $matched matched → handAddFromDeck) → deckToBottomBound (B08075 opt3 同型)。
//     ※公式Q&A: デッキ4枚未満=残り全部見て解決 / 条件満たすカードでも加えない選択可 (=upTo)。
//   - a2 【カットイン】AP＋1000 (常時) + 〚佐藤美和子〛にカットインした場合 draw1 (加算、「代わりに」ではない) =
//     sequence[charModifyAP $contact.byUid +1000 contact, conditional{if contactTargetMatches({names:['佐藤美和子']}) → draw1}] (B06041 a1 同型)。
//     ※公式Q&A: 佐藤美和子以外にもカットイン可 (draw が付かないだけ) = conditional の else 無 = AP+1000 のみ。

import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { chooseMatch: 'upTo', player: 'self', maxN: 4, filter: { cardName: '佐藤美和子', kind: 'character' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '【宣言】〚リムーブエリアに移す〛：自分のデッキのカードを上から4枚見る。その中から〚カード名［佐藤美和子］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
      { kind: 'conditional', if: contactTargetMatches({ names: ['佐藤美和子'] }), then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
    ],
  },
  description: '【カットイン】AP＋1000、〚カード名［佐藤美和子］〛に【カットイン】した場合、カードを1枚引く。（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};

export const B08071: CardDef = {
  id: 'B08071',
  no: '0908/B08071',
  kind: 'character',
  names: ['佐藤正義'],
  colors: ['黄'],
  level: 2, ap: 1000, lp: 1,
  traits: ['警察', '警視庁'], keywords: [],
  rarity: 'C',
  imageUrl: '1770731255756082.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/22-qa-action-contact.md', 'rules/26-qa-deck-refresh.md'],
};
