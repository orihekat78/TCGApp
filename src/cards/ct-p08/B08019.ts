// cards/ct-p08/B08019 大岡紅葉＆伊織無我 (character MR) — 夜間 W0 multi-pick UI 解禁 (2026-07-11)
// rules: 03-field-areas.md, 09-cutin-disguise.md, 15-abilities-effects.md, 16-card-set.md,
//        17-icons.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md,
//        22-qa-action-contact.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   【パートナー緑】【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚カード名［大岡紅葉］〛か
//     〚［伊織無我］〛が登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。
//   【宣言】【ターン1】自分か相手の現場にいるキャラに裏向きでセットされているカードを合わせて2枚
//     リムーブしてもよい。（自分と相手で1枚ずつリムーブできる）そうした場合、カードを1枚引く。
//     この能力は自分の現場に〚カード名［大岡紅葉］〛か〚［伊織無我］〛がいる場合に宣言できる。
//     この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000（コンタクト中に手札からリムーブして使う）
//
// 句マッピング:
//   - MR: rarity 'MR' (read/def.isMR が rarity 前方一致で判定、rules/18 MR①②は engine 側)。
//     Q&A「MR能力によるリムーブは登場と同時 → 登場時点で現場に居らず a1 不発動」= listener 除去順で担保。
//   - 複数名: names = [完全名, 大岡紅葉, 伊織無我] (rules/19 「&」分割、BUG-185 names-split.lint)。
//   - a1【パートナー緑】【自分ターン中】 => condition and[partnerColor 緑, turn self] (rules/17)
//   - a1「自分の現場にこのキャラ以外の[大岡紅葉]か[伊織無我]が登場したとき」
//       => trigger enter + matcherCondition triggerCharMatches{side:'self',
//          filter:{cardName:['大岡紅葉','伊織無我']}, excludeSource:true} (「このキャラ以外」=excludeSource。
//          「か」= cardName 配列 any-match)。効果/能力による登場も発動 (rules/17【登場時】類縁)。
//   - a1「AP8000以下のキャラを1枚まで選び、リムーブする」
//       => sceneRemove 短縮形 {side:'either', max:1, filter:{apMax:8000}} (「まで」=0可 rules/15)
//   - a2【宣言】【ターン1】 => type declared + limit (rules/21)
//   - a2「〜リムーブしてもよい。(自分と相手で1枚ずつ) そうした場合、カードを1枚引く」
//       => optional{chain[charRemoveSetCard{n:2, perSideMax:1, faceDownOnly, filter:hasFaceDownSetCards,
//          side:'either'}, draw]} (「してもよい」=optional / 「合わせて2枚」=n:2 (UI が実選択可能数に
//          clamp、可能な限り rules/15) / 「1枚ずつ」=perSideMax:1 (W4 r84 engine + 夜間W0 multi UI) /
//          「そうした場合」= chain gate (rules/25)。B08035 a2 同型の n:2 拡張)
//   - a2「自分の現場に[大岡紅葉]か[伊織無我]がいる場合に宣言できる」
//       => condition sceneHas{side:'self', filter:{cardName:[...]}} (本カード自身も分割名で該当 rules/19)
//   - a2「パートナーエリアでも宣言できる」 => scope 'always' (declared-ability.ts PA gate 通過、rules/18)
//   - a3【カットイン】AP＋2000 => icon-cutin (charModifyAP $contact.byUid +2000 scope contact、B03116 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '緑' },
      { kind: 'turn', player: 'self' },
    ],
  },
  trigger: {
    hook: 'enter',
    // payloadKey:'uid' 必須 — enter payload は player field を持たず、標準経路は永久 false
    // (B07050 a1 exemplar。side は scene 走査で導出される)
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      filter: { cardName: ['大岡紅葉', '伊織無我'] },
      excludeSource: true,
    },
  },
  // AP8000以下のキャラを1枚まで選び、リムーブする
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', side: 'either', max: 1, filter: { apMax: 8000 } },
  },
  description:
    '【パートナー緑】【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚カード名［大岡紅葉］〛か〚［伊織無我］〛が登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always', // 「この能力はパートナーエリアでも宣言できる」(rules/18)
  limit: { kind: 'turn', n: 1 },
  // 「自分の現場に[大岡紅葉]か[伊織無我]がいる場合に宣言できる」
  condition: {
    kind: 'sceneHas',
    query: { area: 'scene', side: 'self', filter: { cardName: ['大岡紅葉', '伊織無我'] } },
  },
  effect: {
    // 「〜リムーブしてもよい」= optional (rules/15)
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分か相手の現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブ
        // (自分と相手で1枚ずつ = perSideMax:1)
        {
          kind: 'atom',
          verb: 'charRemoveSetCard',
          args: {
            player: 'self',
            side: 'either',
            n: 2,
            minimumPolicy: 'exact',
            perSideMax: 1,
            faceDownOnly: true,
            filter: { hasFaceDownSetCards: true },
          },
        },
        // そうした場合、カードを1枚引く
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
  },
  description:
    '【宣言】【ターン1】自分か相手の現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブしてもよい。（自分と相手で1枚ずつリムーブできる）そうした場合、カードを1枚引く。この能力は自分の現場に〚カード名［大岡紅葉］〛か〚［伊織無我］〛がいる場合に宣言できる。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B08019: CardDef = {
  id: 'B08019',
  no: '0859/B08019',
  kind: 'character',
  names: ['大岡紅葉＆伊織無我', '大岡紅葉', '伊織無我'],
  colors: ['緑'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['高校生', '執事'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1770731204422753.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
