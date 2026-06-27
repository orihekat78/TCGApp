// cards/ct-p07/B07048 白馬探 (character) — engine変更0 (removeSetCard cost, session59 解禁の初実用カード)
// rules: rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//   【パートナー白】【宣言】【ターン1】〚現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブする〛：カードを1枚引き、手札を1枚リムーブする。
// 句マッピング:
//   - 【登場時】 => ability a1: trigger {hook:'enter', selfOnly:true}, scope:'on-scene' [enter selfOnly = 自身の【登場時】 (BUG-146)]
//   - 自分のデッキのカードを上から1枚裏向きでこのキャラにセットする => atom charSetCard {uid:'$self', fromDeckTop:true, player:'self'}
//       [charSetCard explicit-uid + fromDeckTop: host=$self (resolveBindRef _shared.ts:186 → ctx.source.uid)、自分(player:'self')デッキ上端を shift して setCard。
//        faceUp 省略=裏向き (mutate.char.setCard 第4引数 falsy)。BUG-153: host 不在なら deck 非消費。単一 $self set 実証= 1枚setCard 系 (atom-handlers/char.ts:202-237)。]
//   - 【パートナー白】 => ability a2.condition {kind:'partnerColor', color:'白'} [partnerColor cond/eval.ts:37 = パートナー def.colors に指定色を含む。条件未達=能力を持たない (rules/17)]
//   - 【宣言】 => type:'declared', scope:'on-scene' / 【ターン1】 => limit {kind:'turn', n:1}
//   - 〚現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブする〛(コスト) => cost {kind:'removeSetCard', n:2}
//       [removeSetCard COST kind (session59 解禁、cost/evaluate.ts:84 canPay + cost/pay.ts:158 pay)。自陣 scene の裏向き setCard を合わせて n=2 リムーブ。
//        「合わせて」= 複数 host から1枚ずつ可 (公式 B07048 qa「キャラ2枚から1枚ずつリムーブできますか→はい」)。「自分の」省略=自陣のみ (rules/21、pay self-only guard)。]
//   - カードを1枚引き、手札を1枚リムーブする => effect sequence[ atom draw{player:'self', n:1}, atom discard{player:'self', n:1} ]
//       [draw=デッキ上1枚を手札へ / discard=手札1枚をリムーブ (B07024 a2「リムーブ」= discard 実証)。「〜する」=必須 (rules/15)。順序: 引いてから1枚リムーブ。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { uid: '$self', fromDeckTop: true, player: 'self' },
  },
  description: '【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/16-card-set.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '白' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'removeSetCard', n: 2 },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【パートナー白】【宣言】【ターン1】[現場のキャラに裏向きでセットされたカードを合わせて2枚リムーブする]：カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07048: CardDef = {
  id: 'B07048',
  no: '0777/B07048',
  kind: 'character',
  names: ['白馬探'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414010561801.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
