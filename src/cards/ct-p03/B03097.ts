// cards/ct-p03/B03097 目暮みどり (キャラ) — engine拡張 wave#2 cluster3 (2026-06-14) action-lifecycle trigger
// rules: 07-action-flow.md, 08-contact.md, 22-qa-action-contact.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 10-action-event.md, 14-refresh.md
//
// 公式テキスト:
//   相手の現場にいるキャラがアクション［キャラ］したとき、自分の現場にいる〚カード名［目暮十三］〛を1枚まで選び、
//     アクション終了時までAP＋2000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 公式qAndA (cluster3 同族裁定):
//   「『～のキャラがアクション［キャラ］したとき』の能力は、どのタイミングで発動しますか？」
//   → アクションを宣言し、対象を指定してアクションするキャラをスリープさせた時点で発動 (相手がガードするか決めるより前)。
//   よって trigger は action:declare (ガード判定前) で発動し、効果も即解決される。
//
// 句マッピング:
//   - 相手の現場にいるキャラがアクション［キャラ］したとき
//       => trigger hook 'action:declare' (非 selfOnly) +
//          matcherCondition and[ triggerActionKind{v:'char'} (=アクション［キャラ］に限定、cluster3 新 Condition),
//                                triggerCharMatches{side:'opp', filter:{}} ]
//       ※ filter:{} (空) は eval で scene 走査を強制 → パートナーの行動 (.scene 不在) を除外
//         (「現場にいるキャラ」= on-scene char のみ、パートナーエリアのパートナーは対象外、rules/03)
//       ※ side:'opp' = カード所有者から見て相手側 (「相手の現場にいるキャラが」)
//       ※ limit 無し = 毎アクション独立に発動 (テキストに【ターン1】無し)
//   - 自分の現場にいる〚カード名［目暮十三］〛を1枚まで選び、アクション終了時までAP＋2000する
//       => charModifyAP{player:'self', side:'self', filter:{cardName:'目暮十三'}, max:1, delta:2000, scope:'action'}
//         ・side:'self' を明示 (PA短縮形の既定 side='either' の罠を回避。「自分の現場にいる」=自分側のみ、RI-5)
//         ・filter:{cardName:'目暮十三'} = 候補は名前[目暮十三]のキャラに限定 (相手側の目暮十三は side:'self' で候補外)
//         ・max:1 (+ 暗黙 min:0) = 「1枚まで」→ 0枚選択可 (rules/15「～枚まで」)
//         ・scope:'action' = 「アクション終了時まで」(X12 で read/filter 合算 + clearTurnEffects('action') 清掃)
//   - 【ヒラメキ】カードを1枚引く
//       => trigger hook 'evidence:remove-by-action' (optional) → draw{player:'self', n:1} (B03096 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 相手キャラのアクション［キャラ］宣言時、自分の[目暮十三]1枚までを アクション終了時まで AP+2000
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    // 相手の現場にいるキャラがアクション［キャラ］したとき
    //   triggerActionKind{v:'char'} = action[キャラ] に限定 / triggerCharMatches{side:'opp', filter:{}} = 相手側の現場キャラ
    matcherCondition: {
      kind: 'and',
      cs: [
        { kind: 'triggerActionKind', v: 'char' },
        { kind: 'triggerCharMatches', side: 'opp', filter: {} },
      ],
    },
  },
  // 自分の現場にいる〚カード名［目暮十三］〛を1枚まで選び、アクション終了時までAP＋2000する
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: { player: 'self', side: 'self', filter: { cardName: '目暮十三' }, max: 1, delta: 2000, scope: 'action' },
  },
  description:
    '相手の現場のキャラがアクション［キャラ］したとき、自分の現場の[目暮十三]を1枚まで選び、アクション終了時までAP＋2000。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};

// a2: 【ヒラメキ】カードを1枚引く (B03096 a2 同型)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B03097: CardDef = {
  id: 'B03097',
  no: '0350/B03097',
  kind: 'character',
  names: ['目暮みどり'],
  colors: ['黄'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133463280387.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
  ],
};
