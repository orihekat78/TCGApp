// cards/ct-p03/B03086P 伊達航 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［警察］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。
// 句マッピング:
//   - 【登場時】 => trigger  { hook  'enter', selfOnly: true } [src/cards/ct-d01/D01013.ts a1 uses identical { hook  'enter', selfOnly: true } for 【登場時】; hook 'enter' registered in src/engine/types/hooks.ts:39. selfOnly emit source unified to entering char per BUG-146 (brief).]
//   - 自分のデッキのカードを上から3枚見る => deckRevealUntil { player:'self', maxN:3, bind:'$revealed', bindMatch:'$matched' } [src/engine/effect/atom-handlers.ts:1336 deckRevealUntil with maxN reveals min(deck,maxN)=3 then picks first filter match into $matched, rest into $revealed (lines 1396-1410). Exemplars D01013.ts (maxN:4) and B09073.ts (maxN:3) both use this shape.]
//   - その中から〚特徴［警察］〛のキャラを1枚まで公開して手札に加え => chooseMatch:'upTo' + filter:{trait:'警察',kind 'character'}; conditional(bound $matched matched) -> handAddFromDeck($matched.cardId) [targetFilterToPredicate (atom-handlers.ts:78-81) honors filter.trait via d.traits.includes; filter.kind honored at line 92. chooseMatch:'upTo' surfaces human pick nMin:0/nMax:1 (decline-able = 「1枚まで」) at lines 1423-1470 (BUG-132 GAP-1). handAddFromDeck splices deck->hand (capability-map L29). 'bound' presence:'matched' condition honored in src/engine/cond/eval.ts:168-170. Exact composite of D01013.ts (chooseMatch upTo + conditional + handAddFromDeck) and B09073.ts (filter on the reveal char).]
//   - 残りをリムーブエリアに移す => boundToRemove { player:'self', bindKey:'$revealed' } [src/engine/effect/atom-handlers.ts:1536 boundToRemove built specifically for B09073 a2 同句「残りをリムーブエリアに移す」: splices bound revealed ids from deck and calls mutate.remove.add, with post-move refresh (rules/26). Registered in validate.ts:36 and effect.ts:169. Exemplar src/cards/ct-p09/B09073.ts a2 uses boundToRemove({bindKey:'$revealed'}) for the identical phrasing.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: {
            trait: '警察',
            kind: 'character'
          },
          maxN: 3,
          bind: '$revealed',
          bindMatch: '$matched'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$matched',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            deferRefresh: true
          }
        }
      },
      {
        kind: 'atom',
        verb: 'boundToRemove',
        args: {
          player: 'self',
          bindKey: '$revealed',
          refreshAfter: true
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［警察］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B03086P: CardDef = {
  id: 'B03086P',
  no: '0339/B03086P',
  kind: 'character',
  names: [
    '伊達航'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'RP',
  imageUrl: '1729133443631169.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
