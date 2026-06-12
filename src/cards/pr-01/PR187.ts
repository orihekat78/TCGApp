// cards/pr-01/PR187 目暮十三 (キャラ) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 23-qa-disguise-cutin.md
//
// PR181 の絵柄違い (同 card_id 0732・同テキスト・同 Q&A)。id / no / imageUrl のみ PR187 データ。
//
// 公式テキスト:
//   【宣言】【スリープ】：自分のリムーブエリアにあるレベル4以下の〚特徴［警視庁］〛のキャラを1枚まで選び、
//     登場させる。ターン終了時までそのキャラに〚突撃［事件］〛（登場したターンからすぐに事件を指定して
//     アクションできる）と「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。
//
// 句マッピング:
//   - 【宣言】【スリープ】 => type:'declared' + cost {kind:'sleepSelf'} (rules/21)
//   - 自分のリムーブエリアにあるレベル4以下の〚特徴［警視庁］〛のキャラを1枚まで選び、登場させる =>
//     sceneEnter PA短縮形 {from:'remove', max:1, filter:{trait:'警視庁', levelMax:4, kind:'character'}} + bind:'$matched'
//   - ターン終了時までそのキャラに〚突撃［事件］〛を与える => charGrantKeyword {uid:'$matched.uid', scope:'turn'}
//   - 「ターン終了時、このキャラを現場からデッキの下に移す。」を与える =>
//     charSetTurnEffect {uid:'$matched.uid', key:'toDeckBottomOnTurnEnd', val:true} (Task D E4 token)
//   - 0枚選択 / 候補0: '$matched' 未束縛 → 後続 atom は silent no-op (rules/15「〜枚まで」= 0可)
//
// 公式Q&A: 変装で引き継がれる (rules/23 turnEffects 自動引継ぎ) / 現場を離れたら失効 — 両裁定とも engine 設計で自動成立。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】(コスト: このキャラ自身をスリープ)
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分のリムーブエリアにあるレベル4以下の〚特徴［警視庁］〛のキャラを1枚まで選び、登場させる
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true, bind: '$matched', filter: { trait: '警視庁', levelMax: 4, kind: 'character' } } },
      // ターン終了時までそのキャラに〚突撃［事件］〛を与える
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃[事件]', scope: 'turn' } },
      // 「ターン終了時、このキャラを現場からデッキの下に移す。」を与える
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'toDeckBottomOnTurnEnd', val: true } },
    ],
  },
  description:
    '【宣言】【スリープ】：自分のリムーブエリアにあるレベル4以下の〚特徴［警視庁］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラに〚突撃［事件］〛と「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md', 'rules/23-qa-disguise-cutin.md'],
};

export const PR187: CardDef = {
  id: 'PR187',
  no: '0732/PR187',
  kind: 'character',
  names: ['目暮十三'],
  colors: ['黄'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1759195553274055.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
