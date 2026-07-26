// CT-P10 B10027 長島茂雄
// rules: 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'partnerColor', color: '緑' },
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
          kind: 'chain', steps: [
            { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
            { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
          ],
        },
      },
    ],
  },
  description: '【パートナー緑】【宣言】【ターン1】自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。そうした場合、ターン終了時までこのキャラをAP＋1000し、〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10027: CardDef = {
  id: 'B10027', no: '1088/B10027', kind: 'character', names: ['長島茂雄'], colors: ['緑'], level: 5, ap: 5000, lp: 0,
  traits: ['高校生'], keywords: [], rarity: 'C', imageUrl: '1783904116853149.jpg', abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
export const B10027P: CardDef = { ...B10027, id: 'B10027P', no: '1088/B10027P', rarity: 'CP', imageUrl: '1783904116860514.jpg' };
