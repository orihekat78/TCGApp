// cards/ct-p02/B02087 キール (character) — engine A3 wave (2026-07-11)
// rules: 12-next-hint.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   ネクストヒントで手札から使用する場合、このキャラは事件カードの色を無視できる。
//   【登場時】相手の現場にいるキャラにセットされているカードを1枚まで選び、リムーブする。リムーブした場合、
//   ターン終了時までこのキャラは〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を持つ。
//
// 句マッピング:
//   - ネクストヒントで手札から使用する場合、事件カードの色を無視できる =>
//       a1 continuous continuousModifier{colorIgnoreOnNextHint:true} (engine A3 wave: NH 経路限定の色無視 token。
//       colorIgnoreOnHandUse は手札の使用+NH 両経路で over-wide、公式Q&A「ネクストヒントで手札から使用する場合のみ」)
//   - 【登場時】 => a2 type:'triggered' scope:'on-scene' trigger{hook:'enter', selfOnly:true}
//   - 相手の現場にいるキャラにセットされているカードを1枚まで選び、リムーブする =>
//       charRemoveSetCard{player:'self', side:'opp', max:1, filter:{hasSetCards:true}} (B02033 同型、side:'opp'。
//       「1枚まで」= max:1 で 0 枚可、公式Q&A「0枚を選び突撃を持つことはできない」= chain drop で表現)
//   - リムーブした場合、ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ =>
//       chain step2 charGrantKeyword{uid:'$self', kw:'突撃[キャラ]', scope:'turn'} (D11015 a2 同型)。
//       「リムーブした場合」= chain「そうした場合」(step1 が 0 枚/no-candidate なら chain drop → 突撃付与せず)

import type { AbilityDef, CardDef } from '@/engine/types';

// ネクストヒント使用時のみ事件色を無視 (NH 限定 token)
const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  continuousModifier: { colorIgnoreOnNextHint: true },
  description: 'ネクストヒントで手札から使用する場合、このキャラは事件カードの色を無視できる。',
  ruleRefs: ['rules/12-next-hint.md', 'rules/20-color-and-switch.md'],
};

// 【登場時】相手のセットカードを1枚まで除去、除去したら自身に突撃[キャラ] (ターン終了まで)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 相手の現場のキャラにセットされているカードを1枚まで選びリムーブ (0枚可)。除去分を bind。
      { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'opp', max: 1, filter: { hasSetCards: true }, bind: '$removedSet' } },
      // リムーブした場合のみ、ターン終了時までこのキャラは突撃[キャラ] を持つ (0枚 decline は bound not-matched で skip)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$removedSet', presence: 'matched' },
        then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
      },
    ],
  },
  description:
    '【登場時】相手の現場にいるキャラにセットされているカードを1枚まで選び、リムーブする。リムーブした場合、ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};

export const B02087: CardDef = {
  id: 'B02087',
  no: '0248/B02087',
  kind: 'character',
  names: ['キール'],
  colors: ['黒'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1721357309969799.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/13-keywords.md',
    'rules/16-card-set.md',
    'rules/20-color-and-switch.md',
  ],
};
