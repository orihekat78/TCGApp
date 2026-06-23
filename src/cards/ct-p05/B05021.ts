// cards/ct-p05/B05021 森達夫 (character) — wave leave-reveal-until (engine変更0)
// rules: 03-field-areas.md, 14-refresh.md, 17-icons.md, 22-qa-action-contact.md, 26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［毛利小五郎］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - 【相手ターン中】 => condition {turn, player:'opp'} [cond/eval.ts turn; exemplar D05007 a1 同句]
//   - 【現場リムーブ時】(自身) => trigger {hook:'leave:to-remove', selfOnly:true}, scope:'on-scene'
//       [leave:to-remove は登録済 card-triggerable hook、selfOnly=source.uid===card.uid (triggered.ts handleLeaveToRemoveSelf)。exemplar D05007 a1]
//   - 上から〚カード名［毛利小五郎］〛が出るまで1枚ずつ公開 => deckRevealUntil {filter:{cardName:'毛利小五郎'}} (maxN 無 = reveal-until first-match)
//       [cardName は deckRevealUntil predicate で honor (_shared.ts allCardNameComponentsForDef)。exemplar B06053 a1 (reveal-until template)]
//   - それを手札に加える => conditional{if:bound $matched matched, then: handAddFromDeck{cardId:'$matched.cardId'}} (必ず加える; 不在なら no-op)
//   - 残りの公開したカードをデッキの下に移し => deckToBottomBound {bindKey:'$revealed'} (peek順保持。テキストに「好きな順番」無し=faithful)
//   - デッキをシャッフルする => deckShuffle {player:'self'}
// 自己再登場 decoy 不要: 自身は remove へ移動、reveal は deck から (cardName:'毛利小五郎' は自名と非一致)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
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
        args: { player: 'self', filter: { cardName: '毛利小五郎' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［毛利小五郎］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05021: CardDef = {
  id: 'B05021',
  no: '0527/B05021',
  kind: 'character',
  names: ['森達夫'],
  colors: ['青'],
  level: 5,
  ap: 6000,
  lp: 0,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628061737070.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
