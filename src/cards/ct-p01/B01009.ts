// cards/ct-p01/B01009 工藤新一 (character) — engine mini-wave #4 (hand 内 continuous level) 同梱 exemplar
// rules: rules/12-next-hint.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/03-field-areas.md
// 公式テキスト:
//   【パートナー青】お互いの現場にキャラが合わせて6枚以上いる場合、手札にあるこのキャラはレベル4になる。
//   【宣言】〚デッキの下に移す〛：LP0以下の【青】のキャラを1枚まで選び、アクティブにする。
// 公式QA:
//   - 「レベル4の状態で使用したこのキャラは、現場でもレベル4のままですか？」→ いいえ。条件を満たして手札にある間だけ
//     (現場ではレベル6。手札から使用した時点でレベル6) → lvlOverrideInHand は hand gate 専用 (scene level 読み不変)
//   - 「元のLPが0で、効果などによってLP1以上になっているキャラを選ぶことはできますか？」→ いいえ (能力の時点で LP0 以下
//     でなくなっているキャラは選べない) → lpMax:0 は有効 LP (charRead.lp、修正込み) で判定
//   - 「スタン状態のキャラをアクティブにした場合は？」→ スリープになる (mutate/scene.ts setState:509 スタン特殊挙動、rules/03)
// 句マッピング:
//   - 【パートナー青】 => condition and[] 内 {kind:'partnerColor', color:'青'} [VERBATIM src/cards/ct-d01/D01004.ts / B09064.ts a2]
//   - お互いの現場にキャラが合わせて6枚以上いる場合 => {kind:'sceneHas', query:{area:'scene', side:'either'}, nMin:6}
//     [sceneHas query 形は D02013.ts:17 / D08003.ts:44。side:'either' = 両現場合算 (candidates 列挙が両 side を返し
//     cands.length ≥ nMin で判定、cond/eval.ts:132-152)]
//   - 手札にあるこのキャラはレベル4になる => scope:'on-hand' continuous + continuousModifier{lvlOverrideInHand:4}
//     [engine mini-wave #4 primitive。hand-use-card.ts effectiveHandLevel が levelAllowed / next-hint step2 /
//     UI flows.toCandidate / handUseReason の 4 site で honor。tests/engine/effect/miniwave4-hand-level.test.ts pin]
//   - 【宣言】 => type:'declared' [exemplar B09044.ts a1]
//   - 〚デッキの下に移す〛(コスト、対象省略=自身 rules/21) => cost:{kind:'selfToDeckBottom'} [cost/pay.ts:293-298。
//     D07008.ts a1 は pay items 内で使用、単独 cost は直付け (B09003.ts:89 removeDeckTop 直付けと同流儀)]
//   - LP0以下の【青】のキャラを1枚まで選び、アクティブにする => sceneSetState 短縮形 {player, side:'either', max:1,
//     state:'active', filter:{kind:'character', color:'青', lpMax:0}} [短縮形 = D08019.ts:23。side:'either' =
//     エリア指定なし「キャラ」はどちらの現場でも (rules/15)。lpMax = candidates.ts:464 (有効 LP)。
//     「1枚まで」= 0枚可 (rules/15) → max:1。スタン→アクティブはスリープ化 (mutate/scene.ts:509)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-hand',
  // 【パートナー青】+ お互いの現場にキャラが合わせて6枚以上
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '青' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'either' }, nMin: 6 },
    ],
  },
  // 手札にあるこのキャラはレベル4になる (hand gate 専用 — 現場ではレベル6のまま、公式QA)
  continuousModifier: { lvlOverrideInHand: 4 },
  description: '【パートナー青】お互いの現場にキャラが合わせて6枚以上いる場合、手札にあるこのキャラはレベル4になる。',
  ruleRefs: ['rules/12-next-hint.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 〚デッキの下に移す〛: 対象省略コスト = このキャラ自身をデッキの下へ (rules/21)
  cost: { kind: 'selfToDeckBottom' },
  // LP0以下の【青】のキャラを1枚まで選び、アクティブにする (0枚可 rules/15、スタンはスリープ化 rules/03)
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      side: 'either',
      max: 1,
      state: 'active',
      filter: { kind: 'character', color: '青', lpMax: 0 },
    },
  },
  description: '【宣言】〚デッキの下に移す〛：LP0以下の【青】のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md', 'rules/03-field-areas.md'],
};

export const B01009: CardDef = {
  id: 'B01009',
  no: '0005/B01009',
  kind: 'character',
  names: ['工藤新一'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1734349765584400.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
