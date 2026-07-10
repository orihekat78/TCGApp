// cards/ct-p08/B08093 灰原哀＆シェリー (character/MR) — M3 PA batch (2026-07-10)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md,
//        rules/17-icons.md, rules/18-mr.md, rules/19-special-rules.md,
//        rules/20-color-and-switch.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚手札から【現場リムーブ時】を持つ【青】か【黒】のキャラを1枚公開する〛：
//     レベル9以下のキャラを1枚まで選び、リムーブする。
//   【相手ターン中】【現場リムーブ時】自分の手札が2枚以下の場合、カードを1枚引く。
//   【宣言】【ターン1】【青】のキャラを1枚まで選び、ターン終了時までAP＋1000する。
//     【黒】のキャラを1枚まで選び、ターン終了時までAP＋1000する。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   - MR / 2色 => rarity:'MR' / colors:['青','黒'] (rules/20: 手札使用は事件が両色必須。効果登場は色制限なし)。
//     複数名 (rules/19) => names ['灰原哀＆シェリー','灰原哀','シェリー']。
//   - a1「〚手札から【現場リムーブ時】を持つ【青】か【黒】のキャラを1枚公開する〛」=> cost revealFromHand
//     {target pick hand/self filter{keyword:'現場リムーブ時', color:['青','黒'], kind:'character'}, n{1,1}}
//     (B06004 a2/B08068 revealFromHand 同型。keyword:'現場リムーブ時' = ICON_KEYWORD_PREDICATES 登録済
//     read/keyword.ts = 印字参照 (能力有効性は問わない — 公式Q&A)。color 配列 = any-match candidates.ts。
//     hand-pick は kind:'character' 明示 BUG-123)。
//   - a1「レベル9以下のキャラを1枚まで選び、リムーブする」=> sceneRemove{side:'either', max:1,
//     cause:'effect', filter:{levelMax:9}} (「キャラ」= 両現場 rules/15、「まで」= 0枚可)。a1 PA 句なし → on-scene。
//   - a2「【相手ターン中】【現場リムーブ時】自分の手札が2枚以下の場合、カードを1枚引く」=>
//     trigger{hook:'leave:to-remove', selfOnly:true} + condition and[turn:opp, handAtMost{self, 2}]
//     → draw n:1 (B08084 a1 の【相手ターン中】【現場リムーブ時】idiom + handAtMost gate。公式Q&A:
//     相手ターン中の MR リムーブ→PA 移動でも【現場リムーブ時】は発動する)。
//   - a3「【青】のキャラを1枚まで選び…【黒】のキャラを1枚まで選び…AP＋1000する」=> sequence の 2 独立 pick
//     charModifyAP 短縮形 (side:'either' 各色 filter, max:1, delta:1000, scope:'turn')。公式Q&A:
//     現場使用時に自身を2回選んで AP＋2000 可 (各 pick 独立、bind 不要) / 1枚だけ選ぶ (各 max:0) も可。
//   - a3「この能力はパートナーエリアでも宣言できる」=> scope:'on-partner-area' (B06003 a2 同型)。
//   - 【カットイン】AP＋2000 => a4 (D01011/B06003 a3 同型)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚手札から【現場リムーブ時】を持つ【青】か【黒】のキャラを1枚公開する〛
  cost: { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { keyword: '現場リムーブ時', color: ['青', '黒'], kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // レベル9以下のキャラを1枚まで選び、リムーブする
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 9 } },
  },
  description:
    '【宣言】【ターン1】〚手札から【現場リムーブ時】を持つ【青】か【黒】のキャラを1枚公開する〛：レベル9以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【現場リムーブ時】(このキャラが現場からリムーブされたとき)
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  // 【相手ターン中】+ 自分の手札が2枚以下の場合
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'opp' },
      { kind: 'handAtMost', player: 'self', n: 2 },
    ],
  },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【現場リムーブ時】自分の手札が2枚以下の場合、カードを1枚引く。',
  ruleRefs: ['rules/14-refresh.md', 'rules/17-icons.md', 'rules/18-mr.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-partner-area',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // 【青】のキャラを1枚まで選び、ターン終了時までAP＋1000する
      { kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'either', filter: { color: '青' }, delta: 1000, scope: 'turn' } },
      // 【黒】のキャラを1枚まで選び、ターン終了時までAP＋1000する
      { kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'either', filter: { color: '黒' }, delta: 1000, scope: 'turn' } },
    ],
  },
  description:
    '【宣言】【ターン1】【青】のキャラを1枚まで選び、ターン終了時までAP＋1000する。【黒】のキャラを1枚まで選び、ターン終了時までAP＋1000する。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B08093: CardDef = {
  id: 'B08093',
  no: '0929/B08093',
  kind: 'character',
  names: ['灰原哀＆シェリー', '灰原哀', 'シェリー'],
  colors: ['青', '黒'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['少年探偵団', '科学者', '黒ずくめの組織'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1770731270568458.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
