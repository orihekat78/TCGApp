// cards/ct-p07/B07012 本堂瑛祐 (character) — engine変更0 (colorNot filter, session60 解禁)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【解決編】【登場時】自分の現場に【青】以外の色を持つキャラがいる場合、相手の現場にいるレベル4以下のキャラを1枚まで選び、デッキの下に移す。
//   【ヒラメキ】自分のリムーブエリアにある【青】以外の色を持つ〚特徴［高校生］〛のキャラを1枚まで選び、手札に加える。
// 句マッピング:
//   - 【解決編】 => ability.condition {kind:'caseStatus', status:'解決編'} [caseStatus exact shape src/cards/ct-p08/B08088.ts a1 (status:'解決編') / cond/eval.ts:74。条件未達=能力を持たない (rules/17)]
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}, scope:'on-scene' [exemplar B08016.ts a1 / B08020.ts a1。enter emit source=登場キャラ (BUG-146) で selfOnly が自身の【登場時】に一致]
//   - 自分の現場に【青】以外の色を持つキャラがいる場合 => effect conditional.if {kind:'sceneHas', query:{area:'scene', side:'self', filter:{colorNot:'青'}}, nMin:1}
//       [「〜場合」の in-effect 条件は B08016 a1 の effect-conditional と同構造。sceneHas は candidates()→matchOneFilter で計数 (cond/eval.ts:92) → colorNot honored (session60、4 honor site の matchOneFilter)。
//        colorNot=some説 (公式 B08079: 青以外の色を1つ以上持つ=2色{青,X}も該当)。pick-filter での colorNot 実証= B02010 a1 (BUG-159 fix)。]
//   - 相手の現場にいるレベル4以下のキャラを1枚まで選び、デッキの下に移す => then: atom sceneToDeck {player:'opp', max:1, filter:{levelMax:4}}
//       [sceneToDeck PA短縮形 (uid 不在+player+max): chooser=controller (自分が選ぶ) / side=a.player=opp (相手の現場が候補) / pos 既定 'bottom'=デッキの下 / 移動先=所有者(=相手)のデッキ
//        (atom-handlers/scene.ts:318-337 + comment「相手の現場のキャラを…デッキの下に移す」B07080/B08058)。「1枚まで」= max:1 (0可、rules/15)。levelMax:4 = レベル4以下 (matchOneFilter)。]
//   - 【ヒラメキ】 => ability a2: trigger {hook:'evidence:remove-by-action', optional:true}, scope:'on-evidence' [ヒラメキ=証拠からアクションでリムーブされるとき発動 (rules/10)。optional=発動するか相手選択。exemplar B02010 a2 / B07024 a2]
//   - 自分のリムーブエリアにある【青】以外の色を持つ〚特徴［高校生］〛のキャラを1枚まで選び、手札に加える => atom handAddFromRemove {player:'self', max:1, filter:{kind:'character', colorNot:'青', trait:'高校生'}}
//       [handAddFromRemove = リムーブエリアからキャラを手札に (B05050 / B07024 a2: filter:{kind:'character', trait:'高校生'} と同型、本カードは colorNot:'青' を追加)。
//        kind:'character'=「キャラ」(イベント混入防止 BUG-123)。「1枚まで」= max:1 (0可)。colorNot は matchOneFilter で honored (B02010 実証)。]
//   - cutIn / henso (印字なし) => (absent)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'sceneHas',
      query: { area: 'scene', side: 'self', filter: { colorNot: '青' } },
      nMin: 1,
    },
    then: {
      kind: 'atom',
      verb: 'sceneToDeck',
      args: { player: 'opp', max: 1, filter: { levelMax: 4 } },
    },
  },
  description: '【解決編】【登場時】自分の現場に[青]以外の色を持つキャラがいる場合、相手の現場にいるレベル4以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { kind: 'character', colorNot: '青', trait: '高校生' } },
  },
  description: '【ヒラメキ】自分のリムーブエリアにある[青]以外の色を持つ[特徴:高校生]のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B07012: CardDef = {
  id: 'B07012',
  no: '0744/B07012',
  kind: 'character',
  names: ['本堂瑛祐'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413976107871.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
