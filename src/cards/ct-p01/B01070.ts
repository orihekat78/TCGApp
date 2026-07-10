// cards/ct-p01/B01070 アンドレ・キャメル (character) — engine additive WB2 (2026-07-11)
// rules: 07-action-flow.md, 08-contact.md, 10-action-event.md, 13-keywords.md,
//        14-refresh.md, 15-abilities-effects.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   相手の現場にいるキャラがこのキャラを指定してアクションしたとき、そのコンタクト中、このキャラをAP＋1000する。
//   【宣言】【スリープ】：キャラを1枚まで選び、ターン終了時まで〚ブレット〛（このキャラのアクションはガードできない）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   - a1「相手の現場にいるキャラがこのキャラを指定してアクションしたとき、そのコンタクト中、このキャラをAP＋1000」=>
//     triggered action:declare (非 selfOnly = 攻撃側は相手) + matcherCondition triggerCharMatches
//     {payloadKey:'targetUid', requireSource:true} (WB2 engine: requireSource = targetUid が source 自身)
//     → charModifyAP{uid:'$self', delta:1000, scope:'contact'} (D11007 a3 同型)。
//     宣言時発火 (rules/22 ガード判定前) — Q&A「ガードされてコンタクト不参加でもこのキャラは AP+1000」を反映
//     (対象=このキャラである時点で確定、その後ガードで contact 外れても scope:contact 修正は付与済)。
//   - a2「【宣言】【スリープ】：キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える」=> declared, cost sleepSelf,
//     charGrantKeyword{player:'self', side:'either', max:1, kw:'ブレット', scope:'turn'} (B08066 短縮形 pick 同型・filter 無=任意)。
//     「1枚まで」= 0枚可 (rules/15)。対象範囲指定なし = どちらの現場のキャラも可・自身も可 (rules/15)。
//   - a3「【ヒラメキ】カードを1枚引く」=> triggered evidence:remove-by-action optional → draw 1 (D01013 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

// 相手がこのキャラを指定してアクション → コンタクト中このキャラ AP+1000
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    matcherCondition: { kind: 'triggerCharMatches', payloadKey: 'targetUid', requireSource: true },
  },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'contact' } },
  description:
    '相手の現場にいるキャラがこのキャラを指定してアクションしたとき、そのコンタクト中、このキャラをAP＋1000する。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/22-qa-action-contact.md'],
};

// 【宣言】【スリープ】：キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: { player: 'self', side: 'either', max: 1, kw: 'ブレット', scope: 'turn' },
  },
  description:
    '【宣言】【スリープ】：キャラを1枚まで選び、ターン終了時まで〚ブレット〛（このキャラのアクションはガードできない）を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

// 【ヒラメキ】カードを1枚引く
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01070: CardDef = {
  id: 'B01070',
  no: '0060/B01070',
  kind: 'character',
  names: ['アンドレ・キャメル'],
  colors: ['赤'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['FBI'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013053516094.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
