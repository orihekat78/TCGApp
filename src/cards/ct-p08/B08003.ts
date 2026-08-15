// B08003 阿笠博士 — rules/15, 16, 21; official Q&A: stacked cards are not set cards.
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'charStackCard', args: {
    uid: '$self', cardIds: '$pick.cardIds',
    target: { kind: 'pick', chooser: 'self', n: { min: 0, max: 3 }, query: {
      area: 'remove', side: 'self', distinctNames: true,
      filter: { kind: 'character', levelMin: 8, levelMax: 8, trait: '少年探偵団' },
    } },
  } },
  description: '【登場時】自分のリムーブエリアにあるレベル8の、それぞれカード名の異なる〚特徴［少年探偵団］〛のキャラを3枚まで選び、このキャラの下に重ねる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'partnerColor', color: '青' },
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeStackedCards', n: 3 }] },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'bindPick', args: {
      cardIds: '$pick.cardIds', bind: '$chosen',
      target: { kind: 'pick', chooser: 'opp-of-owner', n: { min: 1, max: 1 }, query: {
        area: 'remove', side: 'self', fromCostPaidCards: 'removeStackedCards', filter: { kind: 'character' },
      } },
    } },
    { kind: 'conditional', if: { kind: 'boundMatchesFilter', bindKey: '$chosen', filter: { kind: 'character', levelMax: 8, trait: '少年探偵団' } }, then: {
      kind: 'sequence', steps: [
        { kind: 'atom', verb: 'sceneEnter', args: {
          player: 'self', cardId: '$chosen.cardId', from: 'remove', sourceRequired: true, viaEffect: true,
          deferSceneSwitchChoice: true,
          selectedCardIndex: '$chosen.index',
          target: { kind: 'pick', chooser: 'self', n: { min: 1, max: 1 }, query: { area: 'remove', side: 'self', fromGroupCards: '$chosen' } },
        } },
        { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      ],
    } },
  ] },
  description: '【パートナー青】【宣言】【ターン1】【スリープ】〚このキャラの下に重なっているカードを3枚リムーブする〛：相手はこの【宣言】能力のコストによってリムーブされたキャラの中から1枚選ぶ。それがレベル8以下の〚特徴［少年探偵団］〛のキャラの場合、登場させ、このキャラをリムーブし、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B08003: CardDef = {
  id: 'B08003', no: '0844/B08003', kind: 'character', names: ['阿笠博士'], colors: ['青'],
  level: 7, ap: 3000, lp: 1, traits: ['発明家'], keywords: [], rarity: 'SR', imageUrl: '1766493008955785.jpg',
  abilities: [a1, a2], ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
