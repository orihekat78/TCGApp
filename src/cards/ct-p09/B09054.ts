// cards/ct-p09/B09054 赤井秀一&世良真純 (キャラ MR) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 07-action-flow.md, 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md,
//        17-icons.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
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
//   - a1 【宣言】【ターン1】 => type:'declared' + limit {kind:'turn', n:1}
//   - a1 AP9000以下のキャラを1枚まで選び、リムーブする => sceneRemove PA短縮形
//     {player:'self', max:1, side:'either', cause:'effect', filter:{apMax:9000}}
//     (rules/15: エリア指定なし「キャラ」= どちらの現場でも可・自身も選べる。apMax は効果解決時点の有効AP)
//   - a1 この能力は自分の現場に〚特徴［赤井家］〛のキャラが3枚以上いる場合に宣言できる =>
//     condition {kind:'sceneHas', query:{area:'scene', side:'self', filter:{trait:'赤井家'}}, nMin:3}
//     (公式Q&A: このキャラ自身も3枚に数える → excludeSelf 無し)
//   - a2 【宣言】【ターン1】 => type:'declared' + limit {kind:'turn', n:1}
//   - a2 自分の現場にいる〚特徴［赤井家］〛のアクティブ状態のキャラを1枚まで選び => charSetTurnEffect Pattern A 長形
//     {uid:'$pick', target:{kind:'pick', query:{area:'scene', side:'self', filter:{trait:'赤井家'}, state:['active']}, n:{min:0,max:1}, chooser:'owner'}}
//     (公式Q&A: アクティブ状態であれば自身も選べる → excludeSelf 無し)
//   - a2 相手のターン終了時まで「このキャラはスリープ状態でもガードできる。」を与える =>
//     charSetTurnEffect key:'sleepGuard_oppTurn' val:true (Task D E4 token。'_oppTurn' suffix を
//     read/char.hasTextAbility が読み、flow/turn.ts endTurn(相手) → clearTurnEffects('opp-turn') が
//     suffix 一致キーを清掃 = 相手のターン終了時まで。flow/guard.ts:57 が sleep ガード候補化)
//   - a2 「この能力はパートナーエリアでも宣言できる。」 => ⚠ vacuous (現 engine にパートナーエリアの
//     キャラ slot が存在しないため到達不能。B07093 a2 出荷前例に従い本体句のみ実装・本句は注記のみ。
//     DEFERRED-INDEX 対象句)
//   - a3 【カットイン】AP＋2000 => triggered + scope:'on-hand' + trigger{hook:'effect:declared', optional:true, selfOnly:true}
//     + charModifyAP {uid:'$contact.byUid', delta:2000, scope:'contact'} (D11019 a2 / B05090 a2 同型、rules/09)
//
// 公式Q&A:
//   - スタン状態はガード不可 / ブレットは「できない」優先 / ガード時スリープ化は通常通り → engine 既存配線 ✓
//   - パートナーエリアで使用後、再登場で再使用可 → 【ターン1】counter は uid 単位 (declaredUseCount) で
//     再登場時に新 uid となるため整合 (現状パートナーエリア宣言自体が vacuous)
//   - MR能力 (rules/18 ①相手ターン中離場→パートナーエリア ②MR重複登場リムーブ) はカードテキスト外の
//     フレームルール。engine/mr-partner-area-core (2026-06-23) で配線済 (isMR=rarity 消費 + partnerAreaMR slot)。
//     本カードを含むデッキでは MR①②が実発火する (BUG-154 / engine-mr-partner-area-design.md)

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

export const B09054: CardDef = {
  id: 'B09054',
  no: '0996/B09054',
  kind: 'character',
  names: ['赤井秀一&世良真純', '赤井秀一', '世良真純'],
  colors: ['赤'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['探偵', '高校生', 'FBI', '赤井家'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1775608872693784.jpg',
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
