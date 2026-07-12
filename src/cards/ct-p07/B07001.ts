// cards/ct-p07/B07001 毛利蘭＆灰原哀 (キャラ MR) — S1 wave (2026-07-11, MR pair cost-dyn)
// rules: 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【パートナー青】【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストに
//     よってリムーブされた〚特徴［少年探偵団］〛か〚［毛利探偵事務所］〛のカード1枚につき、ターン終了時まで
//     このキャラをAP＋1000する。ターン終了時までこのキャラは〚突撃〛を持つ。
//   【宣言】【ターン1】自分の現場にいる【青】のキャラを1枚まで選び、ターン終了時までLP－1し、「このキャラは
//     相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。この能力はパートナー
//     エリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   a1: 【パートナー青】=> condition {kind:'partnerColor', color:'青'} (条件外=能力を持たない扱い rules/17)。
//       【宣言】【ターン1】=> type:'declared' + limit{turn,1}。〚デッキのカードを上から3枚リムーブする〛=>
//       cost {kind:'removeDeckTop', player:'self', n:3} (B04077 同型。自分のデッキのみ rules/21・公式Q&A。
//       3枚ない場合は使用不可 = canPay で gate、公式Q&A)。
//     effect = sequence (chain でなく — 0枚 match でも突撃は付く 公式Q&A ゆえ gate しない):
//       step1: 「リムーブされた〚少年探偵団〛か〚毛利探偵事務所〛のカード1枚につき AP＋1000」=>
//              charModifyAP{uid:'$self', delta:{dyn:'$cost.removeDeckTop.traitCountAny:少年探偵団|毛利探偵事務所 * 1000'}}。
//              traitCountAny = any-match の枚数 (両特徴持ちも 1 枚分、公式Q&A)。0枚時 delta 0 = no-op で害なし。
//       step2: 「ターン終了時までこのキャラは〚突撃〛を持つ」=> charGrantKeyword{uid:'$self', kw:'突撃', scope:'turn'}
//              (D04005/PR181 同型)。「パートナーエリアでも」句が a1 には無い → scope:'on-scene' (現場宣言のみ)。
//   a2: 【宣言】【ターン1】=> type:'declared' + limit{turn,1}。「パートナーエリアでも宣言できる」=> scope:'on-partner-area'
//       (B07079 a2 / M3 PA batch 同型)。
//     Pattern A pick (短縮形 charModifyLP + bind:'$picked' → 2 番目 atom で '$picked.uid' 共有。B07079 a2 同型。
//     ⚠ 明示 uid:'$pick'+target の 2-step 共有は human 経路で bind 未解決 no-op = 禁止):
//       step1: 「現場の【青】キャラを1枚まで選び、ターン終了時までLP－1」=> charModifyLP 短縮形
//              {max:1, side:'self', filter:{color:'青'}, delta:-1, scope:'turn', bind:'$picked'}
//              (「1枚まで」=0枚可 rules/15。LP0以下も選択可・delta は raw LP 単位 公式Q&A)。
//       step2: 「『このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。』を与える」=>
//              charSetTurnEffect{uid:'$picked.uid', key:'actionTargetsActive', val:true} (B04077 同型。
//              付与のみで即アクションではない・登場ターンは名乗り状態のまま 公式Q&A)。
//   a3: 【カットイン】AP＋2000 = B07079 a3 同型 (コンタクト中の自側キャラ $contact.byUid を contact scope で加算)。
//   ※ MR能力①② (rules/18) は engine/mr-partner-area-core 配線済 (isMR=rarity 前方一致 消費)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー青】(自分のパートナーが【青】を持つ場合のみ有効 rules/17)
  condition: { kind: 'partnerColor', color: '青' },
  limit: { kind: 'turn', n: 1 },
  // 〚デッキのカードを上から3枚リムーブする〛(コスト: 自分のデッキ上3枚、3枚ない場合は使用不可 rules/21)
  cost: { kind: 'removeDeckTop', player: 'self', n: 3 },
  effect: {
    kind: 'sequence',
    steps: [
      // リムーブされた〚少年探偵団〛か〚毛利探偵事務所〛のカード1枚につき AP＋1000 (any-match 枚数、両特徴も1枚分)
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: { dyn: '$cost.removeDeckTop.traitCountAny:少年探偵団|毛利探偵事務所 * 1000' }, scope: 'turn' } },
      // ターン終了時までこのキャラは〚突撃〛を持つ (0枚 match でも付く 公式Q&A ゆえ sequence)
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
    ],
  },
  description: '【パートナー青】【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：この【宣言】能力のコストによってリムーブされた〚特徴［少年探偵団］〛か〚［毛利探偵事務所］〛のカード1枚につき、ターン終了時までこのキャラをAP＋1000する。ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area', // 「この能力はパートナーエリアでも宣言できる」(rules/18, M3 PA batch)
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // 現場の【青】キャラを1枚まで選び、ターン終了時までLP－1 (短縮形 carrier + bind:'$picked' で次 step と共有)
      { kind: 'atom', verb: 'charModifyLP', args: { max: 1, side: 'self', filter: { color: '青' }, delta: -1, scope: 'turn', bind: '$picked' } },
      // 「相手の現場のアクティブ状態のキャラを指定してアクションできる」を与える (付与のみ、即アクションではない)
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'actionTargetsActive', val: true } },
    ],
  },
  description: '【宣言】【ターン1】自分の現場にいる【青】のキャラを1枚まで選び、ターン終了時までLP－1し、「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
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

export const B07001: CardDef = {
  id: 'B07001',
  no: '0733/B07001',
  kind: 'character',
  names: ['毛利蘭＆灰原哀', '毛利蘭', '灰原哀'],
  colors: ['青'],
  level: 9,
  ap: 8000,
  lp: 1,
  traits: ['少年探偵団', '科学者', '高校生', '毛利探偵事務所', '空手家'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1758249671465789.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
