// cards/ct-p05/B05076P ジョディ・スターリング (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【解決編】相手のターン終了時、自分の現場にいるキャラが2枚以下の場合、相手は手札を1枚リムーブする。（自分の事件が解決編になっている場合、この能力か効果を使える）
// 句マッピング:
//   - 【解決編】 => condition and→caseStatus{status:'解決編'} (owner's case status) [eval.ts:74 caseStatus uses ctx.source.player case.status === cond.status; capability-map line 148. No closure.]
//   - 相手のターン終了時 => trigger.hook:'phase:end:start' gated by condition turn{player:'opp'} [phase:end:start source is undefined → must gate by condition not selfOnly (capability-map line 314). Exemplar B07021 a1 / D08003 a2 use phase:end:start + condition turn. turn:'opp' grounded in D04010 a1 (verb discard player:'opp', condition turn:'opp'); eval.ts:34 turn uses resolvePlayer(cond.player) so 'opp'=opponent-of-owner.]
//   - 自分の現場にいるキャラが2枚以下の場合 => conditional.if = not(sceneHas{query:{area:'scene',side:'self'},nMin:3}) = self scene char count <= 2 (no '<=N' condition exists; expressed as NOT(>=3)) [eval.ts:90 sceneHas = candidates({kind:'all',query}).length >= nMin (counts ALL self scene chars, no filter). 'not' inversion grounded in B07021 a1 (not+sceneHas). Count-all-self-scene pattern grounded in B03103 a1 (sceneHas{area:'scene',side:'self',nMin:5} == '自分の現場にキャラが5枚以上いる場合'). No closure.]
//   - 相手は手札を1枚リムーブする => atom discard {player:'opp', n:1} [EXACT same clause/character: D04010 a1 (ジョディ・スターリング, 赤/FBI) uses verb:'discard' args:{player:'opp',n:1} with description '相手は手札を1枚リムーブする'. atom-handlers.ts:249 discard short-form (n present, no target) builds buildShortFormPick on opp's hand → opponent picks 1 to discard via mutate.hand.discardToRemove. Forced (n:1, not max). No closure.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseStatus',
        status: '解決編'
      },
      {
        kind: 'turn',
        player: 'opp'
      }
    ]
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'not',
      c: {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self'
        },
        nMin: 3
      }
    },
    then: {
      kind: 'atom',
      verb: 'discard',
      args: {
        player: 'opp',
        n: 1
      }
    }
  },
  description: '【解決編】相手のターン終了時、自分の現場にいるキャラが2枚以下の場合、相手は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B05076P: CardDef = {
  id: 'B05076P',
  no: '0576/B05076P',
  kind: 'character',
  names: [
    'ジョディ・スターリング'
  ],
  colors: [
    '赤'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'CP',
  imageUrl: '1747231524192114.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
