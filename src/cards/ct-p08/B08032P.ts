// cards/ct-p08/B08032P 鈴木園子＆京極真 (キャラ MR・パラレル) — Task D batch (2026-06-12)
// rules: 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト (B08032 と同一):
//   〚突撃［キャラ］〛
//   【宣言】〚手札を1枚リムーブする〛：ターン終了時までこのキャラは
//     「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を持つ。
//   【宣言】【ターン1】自分の現場にいる〚カード名［京極真］〛を1枚まで選び、ターン終了時までAP＋1000する。
//     この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング: B08032.ts と同一 (a1: removeFromHand cost → actionTargetsActive / a2: turn1 京極真 AP+1000、
//   パートナーエリア句は vacuous / a3: カットイン AP+2000)。P 版差分は rarity / imageUrl / no のみ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 〚手札を1枚リムーブする〛(コスト: 自分の手札から1枚)
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // ターン終了時までこのキャラは「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を持つ
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'actionTargetsActive', val: true } },
  description: '【宣言】〚手札を1枚リムーブする〛：ターン終了時までこのキャラは「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を持つ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area', // M3 PA batch (2026-07-10): 「この能力はパートナーエリアでも宣言できる」(rules/18)
  limit: { kind: 'turn', n: 1 },
  // 自分の現場にいる[京極真]を1枚まで選び、ターン終了時までAP＋1000する (分割名で自身も対象可 rules/19)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', max: 1, side: 'self', filter: { cardName: '京極真' }, delta: 1000, scope: 'turn' } },
  description: '【宣言】【ターン1】自分の現場にいる〚カード名［京極真］〛を1枚まで選び、ターン終了時までAP＋1000する。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // 【カットイン】AP＋2000 — コンタクト中の自分側キャラ ($contact.byUid) を contact scope で加算
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B08032P: CardDef = {
  id: 'B08032P',
  no: '0871/B08032P',
  kind: 'character',
  names: ['鈴木園子＆京極真', '鈴木園子', '京極真'],
  colors: ['白'],
  level: 9,
  ap: 9000,
  lp: 0,
  traits: ['高校生', '鈴木財閥', '空手家'],
  keywords: ['突撃[キャラ]'],
  rarity: 'MRP',
  imageUrl: '1766493008985360.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
