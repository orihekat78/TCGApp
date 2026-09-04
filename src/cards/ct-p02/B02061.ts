// cards/ct-p02/B02061 世良真純 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】相手に証拠を1つ与えてもよい。そうした場合、このキャラ以外の【赤】のキャラを1枚まで選び、
//     ターン終了時まで〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【登場時】 optional sequence (してもよい。そうした場合) — step1: 相手に証拠を1つ与える
//     (evidenceGain opp, n:1) / step2: このキャラ以外の【赤】を1枚まで選び 突撃[事件] を付与 (turn)。
//     evidenceGain は pick atom ではないため、任意性は outer optional が担う (B01065/B01069 同型)。
// a2: 【ヒラメキ】 evidence:remove-by-action で1ドロー — D08013 a2 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'evidenceGain', args: { player: 'opp', n: 1 } },
        { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$pick', kw: '突撃[事件]', scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { color: '赤' }, excludeSelf: true }, n: { min: 0, max: 1 }, chooser: 'self' } } },
      ],
    },
  },
  description:
    '【登場時】相手に証拠を1つ与えてもよい。そうした場合、このキャラ以外の【赤】のキャラを1枚まで選び、ターン終了時まで〚突撃［事件］〛を与える。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B02061: CardDef = {
  id: 'B02061',
  no: '0224/B02061',
  kind: 'character',
  names: ['世良真純'],
  colors: ['赤'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['探偵', '高校生', '赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357267304419.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
