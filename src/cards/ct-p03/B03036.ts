// cards/ct-p03/B03036 越水七槻 (character) — wave decklook-remove-discard (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p03/character.tsv col10):
//   【登場時】自分のデッキのカードを上から4枚見る。その中から〚特徴［探偵］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   【宣言】【ターン1】【スリープ】〚手札から特徴［探偵］のキャラを1枚リムーブする〛：このキャラ以外のレベル7以下のキャラを1枚まで選び、リムーブする。このキャラを現場からデッキの下に移す。
//
// 句マッピング:
//   a1【登場時】 (exemplar = B05016/B07010 a1 deck-look upTo→handAdd→deckToBottomBound):
//   - 上から4枚見る + 探偵キャラを1枚まで公開して手札に加え
//       => deckRevealUntil{chooseMatch:'upTo', maxN:4, filter:{trait:'探偵', kind:'character'}, bind:'$revealed', bindMatch:'$matched'} → cond($matched) handAddFromDeck
//   - 残りを好きな順番でデッキの下に移す => deckToBottomBound{$revealed}
//   a2【宣言】【ターン1】 (exemplar = B07098 a2 (removeFromHand cost) / D01003 (excludeSelf pick) / B05067 (explicit-target sceneRemove) / PR086 (sceneToDeck uid:'$self')):
//   - 【スリープ】 + 〚手札から特徴[探偵]のキャラを1枚リムーブする〛 (複合コスト)
//       => cost {kind:'pay', items:[{kind:'sleepSelf'}, {kind:'removeFromHand', target:{pick area:'hand' side:'self' filter:{trait:'探偵', kind:'character'}, n:{min:1,max:1}}, n:1}]}
//       ※ 【スリープ】=sleepSelf (active 時のみ payable、rules/21)。手札 cost は「自分の」省略=side:'self'。pay=複合 (両方必須)。
//   - このキャラ以外のレベル7以下のキャラを1枚まで選び、リムーブする
//       => sceneRemove{uid:'$pick', cause:'effect', target:{pick area:'scene' side:'either' excludeSelf:true filter:{levelMax:7}, n:{min:0,max:1}, chooser:'self'}}
//       ※「このキャラ以外」=excludeSelf(query、candidates.ts:211 honored)。「1枚まで」=n.max:1 min:0。「キャラ」=either。
//   - このキャラを現場からデッキの下に移す => sceneToDeck{uid:'$self', pos:'bottom'} ($self=ctx.source.uid、PR086 同型。リムーブでない=【現場リムーブ時】不発動 rules/09/23)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 4,
          filter: { trait: '探偵', kind: 'character' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から4枚見る。その中から〚特徴［探偵］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      {
        kind: 'removeFromHand',
        target: {
          kind: 'pick',
          query: { area: 'hand', side: 'self', filter: { trait: '探偵', kind: 'character' } },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
        n: 1,
      },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          uid: '$pick',
          cause: 'effect',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either', excludeSelf: true, filter: { levelMax: 7 } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
      { kind: 'atom', verb: 'sceneToDeck', args: { uid: '$self', pos: 'bottom' } },
    ],
  },
  description:
    '【宣言】【ターン1】【スリープ】〚手札から特徴［探偵］のキャラを1枚リムーブする〛：このキャラ以外のレベル7以下のキャラを1枚まで選び、リムーブする。このキャラを現場からデッキの下に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B03036: CardDef = {
  id: 'B03036',
  no: '0293/B03036',
  kind: 'character',
  names: ['越水七槻'],
  colors: ['緑'],
  level: 7, ap: 6000, lp: 1,
  traits: ['探偵'], keywords: [],
  rarity: 'C',
  imageUrl: '1729133249320580.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};
