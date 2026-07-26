// CT-P10 B10046 山本萌奈 — rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '怪盗キッド' } }, nMin: 1 },
    then: {
      kind: 'sequence', steps: [
        {
          kind: 'atom', verb: 'bindPick', args: {
            cardIds: '$pick.cardIds', bind: '$picked',
            target: {
              kind: 'pick', chooser: 'self', n: { min: 0, max: 1 },
              query: { area: 'remove', side: 'self', filter: { kind: 'event', trait: 'ビッグジュエル' } },
            },
          },
        },
        {
          kind: 'conditional', if: { kind: 'bound', key: '$picked', presence: 'matched' }, then: {
            kind: 'choice', chooser: 'self', options: [
              { kind: 'atom', verb: 'toPartnerArea', args: { player: 'self', target: '$picked.cardId', selectedCardIndex: '$picked.index', bind: '$moved' } },
              { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', target: '$picked.cardId', selectedCardIndex: '$picked.index', bind: '$moved' } },
            ],
          },
        },
      ],
    },
  },
  description: '自分のターン終了時、自分の現場に〚カード名［怪盗キッド］〛がいる場合、自分のリムーブエリアにある〚特徴［ビッグジュエル］〛のイベントを1枚まで選び、パートナーエリアに移すか手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};

export const B10046: CardDef = {
  id: 'B10046', no: '1106/B10046', kind: 'character', names: ['山本萌奈'], colors: ['白'], level: 4, ap: 4000, lp: 1,
  traits: ['会社員'], keywords: [], rarity: 'C', imageUrl: '1783904138044438.jpg', abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};
