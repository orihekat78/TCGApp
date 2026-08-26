// cards/ct-p09/B09054P 赤井秀一&世良真純 (キャラ MR, パラレル MRP) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 07-action-flow.md, 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md,
//        17-icons.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// B09054 のパラレル (MRP)。公式テキスト・Q&A は B09054 と同一。id / no / rarity / imageUrl のみ P 版データ。
//
// 公式テキスト:
//   【宣言】【ターン1】AP9000以下のキャラを1枚まで選び、リムーブする。
//     この能力は自分の現場に〚特徴［赤井家］〛のキャラが3枚以上いる場合に宣言できる。
//   【宣言】【ターン1】自分の現場にいる〚特徴［赤井家］〛のアクティブ状態のキャラを1枚まで選び、
//     相手のターン終了時まで「このキャラはスリープ状態でもガードできる。」を与える。
//     この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   - a1 【宣言】【ターン1】 + 宣言条件 => declared + limit turn1 + condition sceneHas(赤井家 nMin:3、自身も数える)
//   - a1 AP9000以下のキャラを1枚まで選び、リムーブする => sceneRemove {max:1, side:'either', filter:{apMax:9000}}
//   - a2 【宣言】【ターン1】 => declared + limit turn1
//   - a2 赤井家のアクティブ状態のキャラを1枚まで選び、相手のターン終了時まで「スリープ状態でもガードできる」 =>
//     charSetTurnEffect Pattern A 長形 {uid:'$pick', key:'sleepGuard_oppTurn', val:true,
//     target: pick scene self trait赤井家 state['active'] n{0,1}} (Task D E4 '_oppTurn' token)
//   - a2 「この能力はパートナーエリアでも宣言できる。」 => scope:'on-partner-area'
//     (現場とPA常駐MRの両方で使用可)
//   - a3 【カットイン】AP＋2000 => on-hand triggered effect:declared + charModifyAP $contact.byUid +2000 contact
//
// 公式Q&A: B09054 と同一。MR能力①②とPA宣言scopeはengine配線済み。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // この能力は自分の現場に〚特徴［赤井家］〛のキャラが3枚以上いる場合に宣言できる (自身も数える)
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '赤井家' } }, nMin: 3 },
  // AP9000以下のキャラを1枚まで選び、リムーブする (どちらの現場でも可・自身も選べる)
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 9000 } } },
  description:
    '【宣言】【ターン1】AP9000以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場に〚特徴［赤井家］〛のキャラが3枚以上いる場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area', // M3 PA batch (2026-07-10): 「この能力はパートナーエリアでも宣言できる」(rules/18)
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 自分の現場にいる〚特徴［赤井家］〛のアクティブ状態のキャラを1枚まで選び、相手のターン終了時まで「スリープ状態でもガードできる」を与える
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$pick', key: 'sleepGuard_oppTurn', val: true, target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: '赤井家' }, state: ['active'] }, n: { min: 0, max: 1 }, chooser: 'owner' } } },
  description:
    '【宣言】【ターン1】自分の現場にいる〚特徴［赤井家］〛のアクティブ状態のキャラを1枚まで選び、相手のターン終了時まで「このキャラはスリープ状態でもガードできる。」を与える。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  // AP＋2000 (コンタクト中のキャラを contact scope で加算 → コンタクト終了時に切れる rules/09)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B09054P: CardDef = {
  id: 'B09054P',
  no: '0996/B09054P',
  kind: 'character',
  names: ['赤井秀一&世良真純', '赤井秀一', '世良真純'],
  colors: ['赤'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['探偵', '高校生', 'FBI', '赤井家'],
  keywords: [],
  rarity: 'MRP',
  imageUrl: '1775608872726493.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
