// cards/ct-p08/B08029 小も大を兼ねる (イベント) — Task D batch (2026-06-12)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー緑】自分のリムーブエリアにあるレベル7以下の〚カード名［伊織無我］〛を1枚まで選び、登場させる。
//   ターン終了時までそのキャラに〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与えるか、
//   ターン終了時までそのキャラに「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
//   自分のリムーブエリアにあるレベル7以下の〚カード名［大岡紅葉］〛を1枚まで選び、手札に加える。
//
// 句マッピング:
//   a1: 【パートナー緑】= condition partnerColor 緑 (rules/17: 未達なら何も効果のないイベント)。
//       イベント使用トリガ (B02053 同型) → 最上位 choice (真の2択、chooser:'self')
//     ⚠ 構造ノート (2026-06-12 敵対レビュー): sequence [sceneEnter(bind), choice[grant...], handAdd]
//       形は不可。sequence 内 choice は初期 walk で surface され、choice resume ctx は pick
//       continuation の bindings ('$matched') を持たないため grant が恒久 no-op する (vitest 実証)。
//       → choice を最上位化し、各 option に「登場+grant (sequence、continuation ctx で bind 共有)」と
//       「大岡紅葉回収 (parallel 分離 = 登場 pick を skip しても独立に解決可 — 公式Q&A整合)」を持たせる。
//     deploy: 「リムーブエリアにあるレベル7以下の[伊織無我]を1枚まで選び、登場させる」=
//            sceneEnter 明示 target 形 + bind:'$matched' (PR181/PR187 同型 = Pattern B runtime push、
//            cardName filter は分割名対応 rules/19。max:1 = 0枚可 rules/15)
//     grant: 「ターン終了時までそのキャラに〚突撃[キャラ]〛を与えるか、『…アクティブ状態のキャラを指定して
//            アクションできる。』を与える」= option A: charGrantKeyword 突撃[キャラ] turn /
//            option B: charSetTurnEffect actionTargetsActive。uid:'$matched.uid' (登場 skip 時は
//            未解決 bind → silent no-op = 「そのキャラ」不在で付与なし)
//            (公式Q&A: actionTargetsActive は名乗りを解除しない → 登場ターンのアクションには
//             突撃[キャラ] 側の選択が必要)
//     ooka: 「リムーブエリアにあるレベル7以下の[大岡紅葉]を1枚まで選び、手札に加える」=
//            handAddFromRemove (B02053 a2 同型)。公式Q&A: 伊織を選ばず紅葉のみも可 → parallel で独立

import type { AbilityDef, CardDef, Effect } from '@/engine/types';

// option 毎に新規 object を生成し effect tree 内の共有参照を避ける (walk/Immer 安全)
const deployStep = (): Effect => ({ kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$pick.cardId', from: 'remove', viaEffect: true, bind: '$matched', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { cardName: '伊織無我', levelMax: 7, kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' } } });
const ookaStep = (): Effect => ({ kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '大岡紅葉', levelMax: 7, kind: 'character' } } });
const optionWith = (grant: Effect): Effect => ({ kind: 'parallel', steps: [{ kind: 'sequence', steps: [deployStep(), grant] }, ookaStep()] });

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // 【パートナー緑】(rules/17: 条件未達ならこの能力を持たない = 使えるが何も起こらないイベント)
  condition: { kind: 'partnerColor', color: '緑' },
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  // 突撃[キャラ] を与えるか、「…アクティブ状態のキャラを指定してアクションできる。」を与える (真の2択)
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      optionWith({ kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃[キャラ]', scope: 'turn' } }),
      optionWith({ kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'actionTargetsActive', val: true } }),
    ],
  },
  description: '【パートナー緑】自分のリムーブエリアにあるレベル7以下の〚カード名［伊織無我］〛を1枚まで選び、登場させる。ターン終了時までそのキャラに〚突撃［キャラ］〛を与えるか、ターン終了時までそのキャラに「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。自分のリムーブエリアにあるレベル7以下の〚カード名［大岡紅葉］〛を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};

export const B08029: CardDef = {
  id: 'B08029',
  no: '0869/B08029',
  kind: 'event',
  names: ['小も大を兼ねる'],
  colors: ['緑'],
  level: 8,
  traits: [],
  rarity: 'C',
  imageUrl: '1770731222523320.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
