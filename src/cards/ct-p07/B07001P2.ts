// cards/ct-p07/B07001P2 毛利蘭＆灰原哀 (キャラ MR・パラレル2) — S1 wave (2026-07-11)
// rules: 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト・句マッピング: B07001.ts と同一。P2 版差分は rarity(MRCP) / imageUrl / no のみ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '青' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'removeDeckTop', player: 'self', n: 3 },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: { dyn: '$cost.removeDeckTop.traitCountAny:少年探偵団|毛利探偵事務所 * 1000' }, scope: 'turn' } },
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
    ],
  },
  description: '【パートナー青】【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによってリムーブされた〚特徴［少年探偵団］〛か〚［毛利探偵事務所］〛のカード1枚につき、ターン終了時までこのキャラをAP＋1000する。ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charModifyLP', args: { max: 1, side: 'self', filter: { color: '青' }, delta: -1, scope: 'turn', bind: '$picked' } },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'actionTargetsActive', val: true } },
    ],
  },
  description: '【宣言】【ターン1】自分の現場にいる【青】のキャラを1枚まで選び、ターン終了時までLP－1し、「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B07001P2: CardDef = {
  id: 'B07001P2',
  no: '0733/B07001P2',
  kind: 'character',
  names: ['毛利蘭＆灰原哀', '毛利蘭', '灰原哀'],
  colors: ['青'],
  level: 9,
  ap: 8000,
  lp: 1,
  traits: ['少年探偵団', '科学者', '高校生', '毛利探偵事務所', '空手家'],
  keywords: [],
  rarity: 'MRCP',
  imageUrl: '1763789142308211.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
