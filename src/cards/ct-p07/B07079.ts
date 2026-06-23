// cards/ct-p07/B07079 佐藤美和子＆宮本由美 (キャラ MR) — Task D batch (2026-06-12)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 22-qa-action-contact.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛：
//     AP8000以下のキャラを1枚まで選び、リムーブする。手札からレベル4以下の〚特徴［警視庁］〛のキャラを
//     1枚まで登場させるか、カードを1枚引く。
//   【宣言】【ターン1】〚手札を1枚リムーブする〛：自分の現場にいる〚特徴［警視庁］〛のキャラを1枚まで選び、
//     ターン終了時までAP＋3000し、「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。
//     この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   a1: 【宣言】【ターン1】【スリープ】〚現場にいる…を1枚デッキの下に移す〛= declared + limit{turn,1} +
//       cost pay[sleepSelf, sceneToDeckBottom{side:'self' levelMax7 trait警視庁 n1}] (Task D E2 cost。
//       公式Q&A: コストでは自分のキャラのみ rules/21。デッキ下移動はリムーブでない rules/09・23)
//     step1: 「AP8000以下のキャラを1枚まで選び、リムーブする」= sceneRemove 短縮形 (side:'either' —
//            側指定なしはどちらの現場でも rules/15、apMax filter は有効APで評価)
//     step2: 「手札からレベル4以下の[警視庁]のキャラを1枚まで登場させるか、カードを1枚引く」=
//            choice (真の2択、chooser:'self'): sceneEnter from:'hand' / draw 1
//            (options は bind 非依存の自己完結 atom のため choice walk-surface でも安全。
//             公式Q&A: 効果登場でも【登場時】は発動。viaEffect 登場は色制限なし rules/20)
//   a2: 【宣言】【ターン1】〚手札を1枚リムーブする〛= declared + limit{turn,1} + cost removeFromHand n1
//     step1: 「自分の現場にいる[警視庁]のキャラを1枚まで選び、ターン終了時までAP＋3000し」=
//            charModifyAP 短縮形 (uid/target 非明示) + bind:'$picked' (E0 pick-share)。
//            ⚠ 明示 uid:'$pick'+target 形は禁止: human 経路では初期 walk で pick が push され
//            後続 step が bind 未解決で no-op する (2026-06-12 敵対レビュー vitest 実証)。
//            短縮形は runtime push → sequence continuation が ctx を共有する。
//            (公式Q&A: 現場で使用していれば自身も対象可 — side:'self' + trait:'警視庁' で自身も候補)
//     step2: 「『ターン終了時、このキャラを現場からデッキの下に移す。』を与える」= charSetTurnEffect
//            {uid:'$picked.uid', key:'toDeckBottomOnTurnEnd'} — endTurn consume が scene.toDeck(bottom)
//            (リムーブでない → 【現場リムーブ時】不発動。公式Q&A: 変装には引き継がれる = turnEffects 自動 rules/23)
//     ⚠「この能力はパートナーエリアでも宣言できる」句は partner-area キャラ slot 不存在で vacuous
//       (B07093 a2 出荷前例に従い本体句のみ実装。DEFERRED-INDEX 注記対象)
//   a3: 【カットイン】AP＋2000 = D01011 同型
//   ※ MR能力①② (rules/18) は engine/mr-partner-area-core (2026-06-23) で配線済 (isMR=rarity 消費)。
//     本カードを含むデッキでは MR①②が実発火。card固有「PAでも宣言」句の scope 補正は Phase 4 wave で対応 (BUG-154)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【スリープ】〚現場にいるレベル7以下の特徴[警視庁]のキャラを1枚デッキの下に移す〛(コスト: 全部実行 rules/21)
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'sceneToDeckBottom', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { levelMax: 7, trait: '警視庁' } }, n: { min: 1, max: 1 }, chooser: 'owner' }, n: 1 }] },
  effect: {
    kind: 'sequence',
    steps: [
      // AP8000以下のキャラを1枚まで選び、リムーブする (側指定なし = どちらの現場でも rules/15)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 }, cause: 'effect' } },
      // 手札からレベル4以下の[警視庁]のキャラを1枚まで登場させるか、カードを1枚引く (真の2択)
      { kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { trait: '警視庁', levelMax: 4, kind: 'character' } } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ] },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛：AP8000以下のキャラを1枚まで選び、リムーブする。手札からレベル4以下の〚特徴［警視庁］〛のキャラを1枚まで登場させるか、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 〚手札を1枚リムーブする〛(コスト: 自分の手札から1枚)
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にいる[警視庁]のキャラを1枚まで選び、ターン終了時までAP＋3000し (短縮形 carrier + bind:'$picked' で次 step と共有)
      { kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'self', filter: { trait: '警視庁' }, delta: 3000, scope: 'turn', bind: '$picked' } },
      // 「ターン終了時、このキャラを現場からデッキの下に移す。」を与える (endTurn consume → scene.toDeck bottom、リムーブでない)
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'toDeckBottomOnTurnEnd', val: true } },
    ],
  },
  description: '【宣言】【ターン1】〚手札を1枚リムーブする〛：自分の現場にいる〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時までAP＋3000し、「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/23-qa-disguise-cutin.md'],
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

export const B07079: CardDef = {
  id: 'B07079',
  no: '0807/B07079',
  kind: 'character',
  names: ['佐藤美和子＆宮本由美', '佐藤美和子', '宮本由美'],
  colors: ['黄'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1758249671518016.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
