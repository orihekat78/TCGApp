// cards/ct-p08/B08002 江戸川コナン＆灰原哀 (character/MR) — S1 removal/stack pair Agent4 (2026-07-11)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 18-mr.md, 19-special-rules.md,
//        21-declared-ability-cost.md, 22-qa-action-contact.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー青】【宣言】【ターン1】キャラを1枚まで選び、リムーブする。リムーブした場合、自分のデッキの
//     カードを上からリムーブしたキャラのレベルと同じ枚数リムーブする。
//   【宣言】【ターン1】自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、自分の現場に
//     いる【青】のキャラ1枚の下に重ねる。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   - MR => rarity:'MR'。複数名 (rules/19) => names ['江戸川コナン＆灰原哀','江戸川コナン','灰原哀']。
//   - a1「【パートナー青】…」=> condition partnerColor 青 (B08046 a1 同型)。【ターン1】= limit turn1。
//     scope 'on-scene' (PA 句なし — 【パートナー青】は condition であって PA 宣言可の意味ではない)。
//   - a1「キャラを1枚まで選び、リムーブする」=> sceneRemove{side:'either', max:1, cause:'effect', bind:'$removed'}
//     (「キャラ」= 両現場 rules/15、「まで」= 0枚可)。除去キャラの実効 level/ap/lp を除去前 snapshot し $removed へ bind
//     (scene.ts atomSceneRemove、公式Q&A: 増減状態を参照)。
//   - a1「リムーブした場合、自分のデッキ…レベルと同じ枚数リムーブする」=> mill{n:{dyn:'$removed.level'}}
//     ($removed dyn = dyn/eval.ts resolveRemoved snapLevel)。0枚 pick 時は $removed unbound → level 0 → mill 0
//     (= 「リムーブした場合」不成立)。デッキ不足は可能な限り + refresh (mill 既定挙動 BUG-137、Q&A 一致)。
//   - a2「自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、自分の現場にいる【青】の
//     キャラ1枚の下に重ねる」=> sequence[ bindPick{side:'self', filter:{color:'青', kind:'character'}, n:1, bind:'$host'}
//     (「【青】のキャラ1枚」= 自現場の青キャラ 必須1枚。青 host 0 なら能力は発動するが何も起きない rules/24)、
//     charStackCard{uid:'$host.uid', cardIds:'$pick.cardIds', target pick{remove/self/[少年探偵団]char, 0-1}} ]
//     (B06006 a3 の charStackCard cardIds 契約を host=$host.uid へ差替。charStackCard は選んだ remove card を
//     host 下へ stack + remove から splice、rules/16)。「〜まで選び」= 重ねる側のみ 0 可 (n min0)。
//   - a2「この能力はパートナーエリアでも宣言できる」=> scope:'on-partner-area' (B08046 a2 同型)。
//   - 【カットイン】AP＋2000 => a3 (B08046 a3 同型)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー青】
  condition: { kind: 'partnerColor', color: '青' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'chain',
    steps: [
      // キャラを1枚まで選び、リムーブする (両現場、0枚可)
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: { player: 'self', side: 'either', max: 1, cause: 'effect', bind: '$removed' },
      },
      // リムーブした場合、自分のデッキを上から「リムーブしたキャラのレベル」枚数リムーブ
      { kind: 'atom', verb: 'mill', args: { player: 'self', n: { dyn: '$removed.level' } } },
    ],
  },
  description:
    '【パートナー青】【宣言】【ターン1】キャラを1枚まで選び、リムーブする。リムーブした場合、自分のデッキのカードを上からリムーブしたキャラのレベルと同じ枚数リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にいる【青】のキャラ1枚 (host) を選ぶ
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', filter: { color: '青', kind: 'character' }, n: 1, bind: '$host' } },
      // 自分のリムーブエリアの〚特徴[少年探偵団]〛のキャラを1枚まで選び、host の下に重ねる
      {
        kind: 'atom',
        verb: 'charStackCard',
        args: {
          uid: '$host.uid',
          cardIds: '$pick.cardIds',
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団' } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description:
    '【宣言】【ターン1】自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、自分の現場にいる【青】のキャラ1枚の下に重ねる。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B08002: CardDef = {
  id: 'B08002',
  no: '0843/B08002',
  kind: 'character',
  names: ['江戸川コナン＆灰原哀', '江戸川コナン', '灰原哀'],
  colors: ['青'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団', '科学者'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1766493008948768.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
