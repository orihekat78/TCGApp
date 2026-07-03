// cards/ct-p05/B05115 弁崎素江 (character) — engine mega-wave W3 exemplar (r17, 2026-07-03)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【相手ターン中】相手の能力や効果によって手札からこのカードをリムーブしたとき、
//   このキャラをリムーブエリアから登場させてもよい。
//
// 句マッピング:
//   「【相手ターン中】」=> condition{kind:'turn', player:'opp'} (rules/17)。
//   「相手の能力や効果によって手札からこのカードをリムーブしたとき」=>
//     trigger{hook:'hand:removed', selfOnly:true (=このカードを),
//       matcherCondition:{kind:'triggerByPlayerIs', side:'opp'}} (W3 新 primitive)。
//     emit は mutate.hand.discardToRemove の splice 前 (on-hand scope の in-play scan で発火) —
//     payload.byPlayer = リムーブを起こした効果の起動側。宣言コスト由来 (viaCost) は emit されない
//     (rules/21「コストで行ったことでは条件を満たさない」— 相手コストで自手札は対象にできないため
//     実質防御的 gate)。
//   「このキャラをリムーブエリアから登場させてもよい」=> optional{sceneEnter{cardId:'$trigger.cardId',
//     viaEffect:true, sourceRequired:true, target:{query:{area:'remove', side:'self'}}}}。
//     sourceRequired (W3 新 arg): 公式Q&A「効果を解決するまでにリムーブエリアを離れていた場合、
//     現場に登場させることはできません」— 解決時にリムーブに不在なら登場中止。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'hand:removed',
    selfOnly: true,
    matcherCondition: { kind: 'triggerByPlayerIs', side: 'opp' },
  },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        cardId: '$trigger.cardId',
        viaEffect: true,
        sourceRequired: true,
        target: { query: { area: 'remove', side: 'self' } },
      },
    },
  },
  description: '【相手ターン中】相手の能力や効果によって手札からこのカードをリムーブしたとき、このキャラをリムーブエリアから登場させてもよい。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B05115: CardDef = {
  id: 'B05115',
  no: '0611/B05115',
  kind: 'character',
  names: ['弁崎素江'],
  colors: ['黒'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織', '花見客'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322246376505.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
