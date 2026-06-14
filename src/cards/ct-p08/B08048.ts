// cards/ct-p08/B08048 アンドレ・キャメル (キャラ) — engine拡張 wave#2 cluster3 (action-lifecycle trigger, 2026-06-14)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md,
//        19-special-rules.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   effect: このキャラがアクション［キャラ］したとき、指定したキャラをターン終了時までレベル－1する。
//           そのキャラがレベル6以下の場合、アクション終了時までこのキャラをAP＋3000する。
//   【登場時】自分の現場にこのキャラ以外の〚特徴［FBI］〛のキャラがいる場合、ターン終了時まで
//           このキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//
// 句マッピング:
//   a1: 「このキャラがアクション［キャラ］したとき」=> trigger{hook:'action:declare', selfOnly:true (=このキャラが),
//         matcherCondition: triggerActionKind{v:'char'} (=[キャラ])}。rules/22 qAndA「アクションを宣言し対象を指定して
//         このキャラをスリープさせた時点で発動 (相手のガード判定より前)」= action:declare hook (宣言時発火)。
//       「指定したキャラをターン終了時までレベル－1する」=> charModifyLevel{uid:'$trigger.targetUid' (=指定したキャラ),
//         delta:-1, scope:'turn'} (必須 / rules/19 レベル下限なし)。qAndA「ガードされてもレベル－1されている」=
//         宣言時 snapshot の targetUid を参照 (ガード成立後も差し替えない)。
//       「そのキャラがレベル6以下の場合」=> conditional{if: triggerCharMatches{payloadKey:'targetUid', filter:{levelMax:6}}}。
//         レベル－1 適用 *後* の解決時 level を評価 (qAndA「レベル7を指定→レベル6になっているのでAP＋3000」)。
//         sequence で charModifyLevel を先に実行するため、conditional 時点で修正後 level が反映される。
//       「アクション終了時までこのキャラをAP＋3000する」=> charModifyAP{uid:'$self' (=このキャラ), delta:3000,
//         scope:'action' (=アクション終了時まで / rules/08 §6-7)}。
//   a2: 【登場時】=> trigger{hook:'enter', selfOnly:true}。
//       「自分の現場にこのキャラ以外の〚特徴［FBI］〛のキャラがいる場合」=> conditional{if: sceneHas{query:{area:'scene',
//         side:'self', filter:{trait:'FBI'}, excludeSelf:true}, nMin:1}} (rules/17 条件不成立なら能力を持たない扱い)。
//         qAndA「登場時点で条件を満たしていなければ突撃を持たない / その後 FBI がいなくなっても突撃を失わない」=
//         enter 発火時の一度きり判定 + turn-scope grant で自然成立。
//       「ターン終了時までこのキャラは〚突撃〛を持つ」=> charGrantKeyword{uid:'$self', kw:'突撃', scope:'turn'}
//         (⚠ grantKeyword に 'action' は使わない — turn で実装。D08011/D06006 同型)。
//   ※ hirameki なし (TSV に hirameki 列なし)。ミスリードなし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラがアクション［キャラ］したとき (selfOnly=このキャラが / triggerActionKind char=[キャラ])
  trigger: {
    hook: 'action:declare',
    selfOnly: true,
    matcherCondition: { kind: 'triggerActionKind', v: 'char' },
  },
  effect: {
    kind: 'sequence',
    steps: [
      // 指定したキャラをターン終了時までレベル－1する (必須)
      { kind: 'atom', verb: 'charModifyLevel', args: { uid: '$trigger.targetUid', delta: -1, scope: 'turn' } },
      // そのキャラがレベル6以下の場合 (レベル－1 適用後の解決時 level を評価)、アクション終了時までこのキャラをAP＋3000する
      {
        kind: 'conditional',
        if: { kind: 'triggerCharMatches', payloadKey: 'targetUid', filter: { levelMax: 6 } },
        then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 3000, scope: 'action' } },
      },
    ],
  },
  description:
    'このキャラがアクション［キャラ］したとき、指定したキャラをターン終了時までレベル－1する。そのキャラがレベル6以下の場合、アクション終了時までこのキャラをAP＋3000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場にこのキャラ以外の〚特徴［FBI］〛のキャラがいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'FBI' }, excludeSelf: true }, nMin: 1 },
    // ターン終了時までこのキャラは〚突撃〛を持つ
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  },
  description:
    '【登場時】自分の現場にこのキャラ以外の〚特徴［FBI］〛のキャラがいる場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};

export const B08048: CardDef = {
  id: 'B08048',
  no: '0886/B08048',
  kind: 'character',
  names: ['アンドレ・キャメル'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 0,
  traits: ['FBI'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731238601063.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
