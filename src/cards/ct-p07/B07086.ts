// cards/ct-p07/B07086 榎本杉人 (character) — wave leave-reveal-until (engine変更0)
// rules: 03-field-areas.md, 11-reasoning.md, 13-keywords.md, 14-refresh.md, 17-icons.md, 26-qa-deck-refresh.md
// 公式テキスト:
//   a1 〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   a2 【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［榎本梓］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。カードを手札に加えた場合、手札を1枚リムーブする。
// 句マッピング:
//   - a1 〚ミスリード1〛 => misreadX({x:1}) 共通クラス (type:'icon-misread')。exemplar D01010 a1
//   - a2 leave:to-remove selfOnly + turn:opp + deckRevealUntil{cardName:'榎本梓'} (reveal-until)。exemplar B06053 a1 / D05007 a1
//   - それを手札に加える + カードを手札に加えた場合、手札を1枚リムーブする =>
//       conditional{if:bound $matched matched, then: sequence:[handAddFromDeck{cardId:'$matched.cardId'}, discard{player:'self', n:1}]}
//       ★GUARD 内包必須: discard は「加えた場合」のみ発火 (公式Q&A: 榎本梓が見つからず全公開した場合は手札をリムーブしない)。
//        discard を conditional 外に出すと over-fire (加えていないのにリムーブ) になる。exemplar D01013 (conditional[handAddFromDeck,…])
//   - 「手札を1枚リムーブする」= 自分の手札 discard n:1 (必須、してもよい でない)。exemplar D01003/D08015 discard{player:'self',n:1}
//   - 残り…デッキ下→シャッフル => deckToBottomBound → deckShuffle (discard は hand ゾーン / これらは deck ゾーンで disjoint、最終state不変)

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({ x: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { visibility: 'public', viewer: 'all', player: 'self', filter: { cardName: '榎本梓' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
            { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
          ],
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［榎本梓］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B07086: CardDef = {
  id: 'B07086',
  no: '0814/B07086',
  kind: 'character',
  names: ['榎本杉人'],
  colors: ['黄'],
  level: 5,
  ap: 6000,
  lp: 0,
  traits: ['証券会社社員'],
  rarity: 'C',
  imageUrl: '1762414027419560.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
