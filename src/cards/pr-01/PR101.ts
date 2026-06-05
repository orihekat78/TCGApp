// cards/pr-01/PR101 萩原研二 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【解決編】【登場時】自分の現場にいる〚カード名［降谷零］〛か〚［諸伏景光］〛か〚［伊達航］〛か〚［萩原研二］〛か〚［松田陣平］〛を1枚スリープさせてもよい。
//     そうした場合、レベル6以下のスリープ状態のキャラを1枚まで選び、リムーブする。
//
// a1: 【解決編】(condition caseStatus) 【登場時】(enter selfOnly) → chain:
//     step1 自分の現場の指定カード名を1枚スリープさせてもよい (max:1) → そうした場合 step2 レベル6以下スリープを1枚までリムーブ
//     ("してもよい。そうした場合" = chain。step1 が no-candidate/skip なら step2 break。D08003 a1 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 自分の現場にいる[降谷零]か[諸伏景光]か[伊達航]か[萩原研二]か[松田陣平]を1枚スリープさせてもよい
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'self', state: 'sleep', filter: { cardName: ['降谷零', '諸伏景光', '伊達航', '萩原研二', '松田陣平'] } } },
      // そうした場合、レベル6以下のスリープ状態のキャラを1枚まで選び、リムーブする (step1 applied 時のみ)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 6 }, state: ['sleep'] } },
    ],
  },
  description:
    '【解決編】【登場時】現場の指定カード名を1枚スリープさせてもよい。そうした場合 レベル6以下スリープを1枚までリムーブ。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR101: CardDef = {
  id: 'PR101',
  no: '0488/PR101',
  kind: 'character',
  names: ['萩原研二'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '195c36986171c1.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
