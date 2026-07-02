// cards/ct-p09/B09072P 横溝重悟 (キャラ, パラレル) — engine変更0 (wave-8 flag consumer + carrier-reuse)
// 公式テキスト・句マッピングは B09072 を参照 (同一 ability)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'flag', player: 'self', key: 'shippuFiredThisTurn', v: true },
    then: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 2 } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
  },
  description: '【登場時】このターン中、自分のキャラの【疾風】が発動していた場合、自分のデッキのカードを上から2枚リムーブし、カードを1枚引く。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', filter: { trait: '神奈川県警' }, state: 'active', bind: '$picked' } },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'cannotReason', val: true } },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】〚手札を1枚リムーブする〛：〚特徴［神奈川県警］〛のキャラを1枚まで選び、アクティブにし、ターン終了時まで「このキャラは推理できない。」を与える。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const B09072P: CardDef = {
  id: 'B09072P',
  no: '1012/B09072P',
  kind: 'character',
  names: ['横溝重悟'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'SRP',
  imageUrl: '1775608890188125.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/10-action-event.md', 'rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
