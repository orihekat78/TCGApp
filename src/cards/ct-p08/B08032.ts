// cards/ct-p08/B08032 鈴木園子＆京極真 (キャラ MR) — Task D batch (2026-06-12)
// rules: 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   〚突撃［キャラ］〛
//   【宣言】〚手札を1枚リムーブする〛：ターン終了時までこのキャラは
//     「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を持つ。
//   【宣言】【ターン1】自分の現場にいる〚カード名［京極真］〛を1枚まで選び、ターン終了時までAP＋1000する。
//     この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   keywords: ['突撃[キャラ]'] (rules/13: 名乗り状態でもアクション[キャラ]可)
//   a1: 【宣言】= type:'declared'。〚手札を1枚リムーブする〛= cost removeFromHand n1 (rules/21:
//       コストは自分の手札のみ)。「ターン終了時までこのキャラは『…アクティブ状態のキャラを指定して
//       アクションできる。』を持つ」= charSetTurnEffect{uid:'$self', key:'actionTargetsActive'}
//       (clearTurnEffects('turn') 清掃 = ターン終了時まで)
//   a2: 【宣言】【ターン1】= declared + limit{turn,1}。「自分の現場にいる[京極真]を1枚まで選び、
//       ターン終了時までAP＋1000する」= charModifyAP 短縮形 (side:'self', cardName filter は分割名対応
//       rules/19 — このカード自身も [京極真] を持つため対象可、公式Q&A同旨)。
//       ⚠「この能力はパートナーエリアでも宣言できる」句は partner-area キャラ slot 不存在で vacuous
//         (B07093 a2 出荷前例に従い本体句のみ実装。DEFERRED-INDEX 注記対象)
//   a3: 【カットイン】AP＋2000 = D01011 同型 inline atom ($contact.byUid + contact scope)
//   ※ MR能力①② (rules/18: 相手ターン離場→パートナーエリア / MR重複リムーブ) は
//     engine/mr-partner-area-core (2026-06-23) で配線済 (isMR=rarity 消費)。本カードを含むデッキでは実発火。
//     card固有「PAでも宣言」句の scope 補正は Phase 4 wave で対応 (BUG-154)

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
  scope: 'on-scene',
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

export const B08032: CardDef = {
  id: 'B08032',
  no: '0871/B08032',
  kind: 'character',
  names: ['鈴木園子＆京極真', '鈴木園子', '京極真'],
  colors: ['白'],
  level: 9,
  ap: 9000,
  lp: 0,
  traits: ['高校生', '鈴木財閥', '空手家'],
  keywords: ['突撃[キャラ]'],
  rarity: 'MR',
  imageUrl: '1766493008979873.jpg',
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
