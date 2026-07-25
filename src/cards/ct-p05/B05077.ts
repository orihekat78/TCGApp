// cards/ct-p05/B05077 ジョディ・サンテミリオン (character) — wave leave-reveal-until (engine変更0)
// rules: 03-field-areas.md, 14-refresh.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上からレベル4以下の〚カード名［ジョディ・スターリング］〛が出るまで1枚ずつ公開し、それを登場させる。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】(自身) => trigger{hook:'leave:to-remove', selfOnly:true} + condition{turn, player:'opp'}。exemplar D05007 a1
//   - 上からレベル4以下の〚カード名［ジョディ・スターリング］〛が出るまで1枚ずつ公開 =>
//       deckRevealUntil {filter:{cardName:'ジョディ・スターリング', levelMax:4, kind:'character'}} (maxN 無 = reveal-until)
//       [cardName/levelMax/kind すべて deckRevealUntil predicate で honor。kind:'character' は「登場させる」対象=キャラを明示 (D05007 filter と同様)]
//   - それを登場させる => conditional{if:bound $matched matched, then: sceneEnter{cardId:'$matched.cardId', target:{query:{area:'deck',side:'self'}}, viaEffect:true}}
//       [「登場させる」= 通常登場 (active)。「スリープ状態で」記載なし → enterSleep 指定なし。exemplar D05007 a1 (但し D05007 は enterSleep:true)]
//   - 残りの公開したカードをデッキの下に移し => deckToBottomBound {bindKey:'$revealed'}
//   - デッキをシャッフルする => deckShuffle {player:'self'} (D05007 はシャッフル無テキストゆえ無、本カードは有)
// 自己再登場 decoy 不要: 自身 (ジョディ・サンテミリオン) は remove へ移動、filter は cardName:'ジョディ・スターリング' で自名と非一致。

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
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          filter: { cardName: 'ジョディ・スターリング', levelMax: 4, kind: 'character' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            viaEffect: true,
            target: { query: { area: 'deck', side: 'self' } },
          },
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上からレベル4以下の〚カード名［ジョディ・スターリング］〛が出るまで1枚ずつ公開し、それを登場させる。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05077: CardDef = {
  id: 'B05077',
  no: '0577/B05077',
  kind: 'character',
  names: ['ジョディ・サンテミリオン'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['教師'],
  rarity: 'C',
  imageUrl: '1745322226153484.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
