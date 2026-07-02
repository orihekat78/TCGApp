// cards/ct-p03/B03051 怪盗キッド (character) — card-authoring wave15 stale-DEFER 解禁 (engine変更0, 2026-07-02)
// rules: 03-field-areas.md, 09-cutin-disguise.md, 12-next-hint.md, 14-refresh.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー白】【登場時】自分のデッキのカードを下から1枚手札に加える。
//   【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
//
// 公式Q&A (cards-data ct-p03 TSV):
//   Q: デッキが残り1枚の場合はどうしますか？
//   A: その1枚を手札に加えます。（デッキのカードがなくなるのでリフレッシュを行います。） → handAddFromDeckBottom が
//      take 後 deck0 で即リフレッシュ (rules/14 即座、rules/26)。verb 本体で担保 (core.ts atomHandAddFromDeckBottom)。
//   Q: 【変装】によってこのキャラの【登場時】能力や他のキャラの「〜登場したとき」能力は発動しますか？
//   A: いいえ、【変装】による入れ替えは登場ではないので発動しません。 → a2 (icon-disguise) は 'enter' hook を emit しない
//      (rules/09、B02038 a1/a2 同論拠) ため a1 (hook 'enter') は変装で二重発火しない。
//
// 句マッピング:
//   【パートナー白】【登場時】自分のデッキのカードを下から1枚手札に加える
//     => a1: type 'triggered' scope 'on-scene', condition {partnerColor '白'}, trigger {hook 'enter', selfOnly:true},
//        effect atom handAddFromDeckBottom {player:'self'}
//     - 【パートナー白】= condition partnerColor '白' (rules/17: 自パートナーが指定色を持つ。未充足なら能力を持たない扱い
//       = 発動しない)。D01004.ts a1 が partnerColor gate + hook 'enter' の同居形を実証。
//     - 【登場時】= trigger {hook 'enter', selfOnly:true} (rules/17、B02038.ts a2 / D05006.ts a1 同型。source.uid=登場キャラ)。
//     - 「デッキのカードを下から1枚手札に加える」= atom handAddFromDeckBottom {player:'self'} (engine additive 2026-06-29,
//       本カード専用に追加された sole-gate verb。デッキ末尾=「下」1枚を pop→手札。pick 無しの fixed verb=draw 同型。
//       take 前後の deck0 refresh を verb 内で処理 (上記 Q&A)。'する'=必須ゆえ bare atom (optional なし)。
//     - latent 注記 (DEFERRED-INDEX): enterCountAtMost 系 pre-walk over-fire は [sceneEnter, conditional] 並びの話。
//       本 a1 は単一 atom + ability.condition ゆえ該当せず (conditional 枝も pick も無い)。
//   【変装】【事件白】【FILE6】 => a2: type 'icon-disguise', condition and[caseColor '白', fileAtLeast 6]
//     - B02038.ts a3 の完全 clone (同 怪盗キッド henso【変装】【事件白】、n のみ FILE4→FILE6)。B03129.ts a1 が
//       fileAtLeast n:6 を実証。canDisguise が ability.condition を評価 (contact.ts)、未充足で変装不可 (rules/17)。
//     - icon 本体に effect/cost 無し (変装の入替は contact.ts が処理、rules/09)。本カードに【変装時】effect は印字なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '白' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'handAddFromDeckBottom',
    args: { player: 'self' },
  },
  description: '【パートナー白】【登場時】自分のデッキのカードを下から1枚手札に加える。',
  ruleRefs: ['rules/12-next-hint.md', 'rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'icon-disguise',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: '白' },
      { kind: 'fileAtLeast', n: 6 },
    ],
  },
  description: '【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

export const B03051: CardDef = {
  id: 'B03051',
  no: '0306/B03051',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['怪盗'],
  rarity: 'C',
  imageUrl: '1729133385800160.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
