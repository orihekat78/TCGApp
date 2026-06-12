// cards/pr-01/PR181 目暮十三 (キャラ) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【宣言】【スリープ】：自分のリムーブエリアにあるレベル4以下の〚特徴［警視庁］〛のキャラを1枚まで選び、
//     登場させる。ターン終了時までそのキャラに〚突撃［事件］〛（登場したターンからすぐに事件を指定して
//     アクションできる）と「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。
//
// 句マッピング:
//   - 【宣言】【スリープ】 => type:'declared' + cost {kind:'sleepSelf'} (rules/21)
//   - 自分のリムーブエリアにあるレベル4以下の〚特徴［警視庁］〛のキャラを1枚まで選び、登場させる =>
//     sceneEnter PA短縮形 {player:'self', from:'remove', max:1, filter:{trait:'警視庁', levelMax:4, kind:'character'}}
//     (B07082 a1 同型。sourceSplice でリムーブから実体除去。bind:'$matched' で登場キャラの uid を
//     ctx.bindings へ writeback — 後続 atom が「そのキャラ」を '$matched.uid' で参照。
//     効果登場 = 名乗り状態で登場 (rules/06、BUG-093 named:true 既定))
//   - ターン終了時までそのキャラに〚突撃［事件］〛を与える => charGrantKeyword {uid:'$matched.uid', kw:'突撃[事件]', scope:'turn'}
//     (D11019 a1 同型。名乗り例外 rules/13: 登場ターンからアクション[事件]可)
//   - 「ターン終了時、このキャラを現場からデッキの下に移す。」を与える =>
//     charSetTurnEffect {uid:'$matched.uid', key:'toDeckBottomOnTurnEnd', val:true}
//     (Task D E4 token。flow/turn.ts endTurn が phase:end:start trigger 後・clearTurnEffects 前に
//     consume し scene.toDeck(bottom)。rules/05 ①能力発動→②効果切れ の順序を保証)
//   - 0枚選択 / 候補0 の場合: '$matched' 未束縛 → 後続 2 atom は silent no-op (rules/15「〜枚まで」= 0可)
//
// 公式Q&A:
//   - 登場キャラが【変装】した場合も「デッキの下に移す」は引き継がれる → turnEffects は uid 単位で
//     変装入替え時に自動引継ぎ (rules/23) ✓
//   - 登場キャラが現場を離れていた場合はターン終了時に発動しない → turnEffects はキャラ離場で消滅 ✓

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

export const PR181: CardDef = {
  id: 'PR181',
  no: '0732/PR181',
  kind: 'character',
  names: ['目暮十三'],
  colors: ['黄'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1759195553239837.jpg',
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
