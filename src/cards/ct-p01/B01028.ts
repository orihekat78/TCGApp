// cards/ct-p01/B01028 服部平次 (キャラ) — catalog-reuse batch
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。
//   このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP＋1000する。
//   【パートナー緑】【自分ターン中】【ターン1】このキャラがコンタクトしたとき、このキャラをアクティブにする。
//
// a1: action:pre-target でアクション対象拡張 — 相手の現場のアクティブも対象可 (D11007 a1 同型)。
// a2: contact:start でこのキャラを AP＋1000 (コンタクト中、強制) (D11007 a3 chain の charModifyAP 部分を単発化)。
// a3: 【パートナー緑】【自分ターン中】【ターン1】contact:start でこのキャラをアクティブにする (sceneSetState uid:$self state:active)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: アクション対象拡張 — このキャラが attacker のとき、相手の現場のアクティブも対象可
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // アクションでこのカードが選ばれたとき
  trigger: { hook: 'action:pre-target', selfOnly: true },
  // 相手の現場のアクティブを対象に追加
  effect: { kind: 'atom', verb: 'expandActionTargets', args: { side: 'opp', state: ['active'] } },
  description: 'このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md'],
};

// a2: このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP＋1000する (強制)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラがコンタクトしたとき
  trigger: { hook: 'contact:start', selfOnly: true },
  // そのコンタクト中、このキャラを AP＋1000
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'contact' } },
  description: 'このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP＋1000する。',
  ruleRefs: ['rules/08-contact.md', 'rules/22-qa-action-contact.md'],
};

// a3: 【パートナー緑】【自分ターン中】【ターン1】コンタクト時にこのキャラをアクティブにする
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー緑】【自分ターン中】
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '緑' }, { kind: 'turn', player: 'self' }] },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // このキャラがコンタクトしたとき
  trigger: { hook: 'contact:start', selfOnly: true },
  // このキャラをアクティブにする
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  description: '【パートナー緑】【自分ターン中】【ターン1】このキャラがコンタクトしたとき、このキャラをアクティブにする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

export const B01028: CardDef = {
  id: 'B01028',
  no: '0022/B01028',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1714013000981245.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
