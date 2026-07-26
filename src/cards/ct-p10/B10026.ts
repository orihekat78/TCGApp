// CT-P10 B10026 稲尾一久
// rules: 15-abilities-effects.md, 16-card-set.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene', cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'chain', steps: [
      {
        kind: 'atom', verb: 'charRemoveSetCard',
        args: {
          player: 'self', side: 'either', max: 1,
          filter: { hasFaceDownSetCards: true }, faceDownOnly: true, bind: '$removedSet',
        },
      },
      {
        kind: 'conditional', if: { kind: 'bound', key: '$removedSet', presence: 'matched' },
        then: {
          kind: 'atom', verb: 'sceneRemove',
          args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', levelMaxBound: { bindKey: '$removedSet' } } },
        },
      },
    ],
  },
  description: '【宣言】【スリープ】：自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。そうした場合、リムーブしたカードのレベル以下のレベルのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B10026: CardDef = {
  id: 'B10026', no: '1087/B10026', kind: 'character', names: ['稲尾一久'], colors: ['緑'], level: 6, ap: 6000, lp: 0,
  traits: ['高校生'], keywords: [], rarity: 'C', imageUrl: '1783904116839473.jpg', abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
export const B10026P: CardDef = { ...B10026, id: 'B10026P', no: '1087/B10026P', rarity: 'CP', imageUrl: '1783904116846494.jpg' };
