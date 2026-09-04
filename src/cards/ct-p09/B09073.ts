// cards/ct-p09/B09073 萩原研二 (キャラ) — engine拡張 wave#2 cluster2 (2026-06-12)
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p09/character.tsv。P 版 B09073P と effect/cutIn/hirameki/henso 完全一致):
//   【宣言】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。
//     この能力は自分の現場に【疾風】を持つキャラがいる場合に宣言できる。
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。
//     その中から【疾風】を持つキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。
//     レベル8以上のカードを手札に加えた場合、手札を1枚リムーブする。
//
// 句マッピング:
//   a1: 【宣言】【スリープ】=> type:'declared', cost:{kind:'sleepSelf'} (元々 sleep/stun なら canPay=false で宣言不可 — rules/21)
//     - 宣言可能条件「自分の現場に【疾風】を持つキャラがいる」=> condition:sceneHas{side:'self', filter:{keyword:'疾風'}, nMin:1}
//         ※ 疾風(【疾風 N】icon) も ability-presence filter 対象。印字静的判定 — 有効/発動可否は問わない (公式Q&A「有効かどうかに関係なく…該当」)
//     - AP8000以下のキャラを1枚まで選び、リムーブする => sceneRemove{max:1, side:'either', cause:'effect', filter:{apMax:8000}} (両現場・0枚可 rules/15)
//   a2: 【相手ターン中】【現場リムーブ時】(condition turn:opp + trigger leave:to-remove selfOnly) => sequence:
//     1) デッキ上から3枚見る => deckRevealUntil{chooseMatch:'upTo', maxN:3, filter:{keyword:'疾風', kind:'character'}} → $matched + $revealed
//          ※ 「見ている間はデッキ扱い」(rules/26)。reveal 中は refresh しない
//     2) 【疾風】を持つキャラを1枚まで公開して手札に加え => conditional($matched) → handAddFromDeck($matched.cardId) (0枚可・該当あっても加えない選択可 — 公式Q&A)
//     3) 残りをリムーブエリアに移す => boundToRemove{$revealed} (新 verb X6。「移すまで解決したところで」初めてデッキから出る → ここで deck0 なら refresh — 公式Q&A / rules/26)
//     4) レベル8以上のカードを手札に加えた場合、手札を1枚リムーブ => conditional(boundMatchesFilter $matched levelMin:8) → discard1
//   ⚠ 句順 pin: handAdd(2) → boundToRemove(3) → 条件 discard(4)。discard を boundToRemove より先に置くと
//     refresh で remove 済カードが山札へ戻り挙動が変わるため、公式文の語順どおり厳守。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【宣言】【スリープ】(コスト = 自身スリープ。元々 sleep/stun なら canPay=false で宣言不可)
  cost: { kind: 'sleepSelf' },
  // この能力は自分の現場に【疾風】を持つキャラがいる場合に宣言できる (presence は印字静的判定 — 有効/発動可否は問わない)
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { keyword: '疾風' } }, nMin: 1 },
  // AP8000以下のキャラを1枚まで選び、リムーブする (両現場・0枚可 rules/15)
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } },
  },
  description:
    '【宣言】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場に【疾風】を持つキャラがいる場合に宣言できる。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【現場リムーブ時】(このキャラ自身がリムーブされたとき)
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  // 【相手ターン中】
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'sequence',
    steps: [
      // デッキ上から3枚見る — 【疾風】を持つキャラを $matched に bind (presence 静的判定 / 残りは $revealed)
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { chooseMatch: 'upTo', player: 'self', filter: { keyword: '疾風', kind: 'character' }, maxN: 3, bind: '$revealed', bindMatch: '$matched' },
      },
      // 該当があれば 1枚まで公開して手札に加える (該当あっても加えない選択可 — 公式Q&A。加えなければ後続条件も不成立)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', deferRefresh: true } },
      },
      // 残りの公開カードをリムーブエリアに移す (X6。ここで初めてデッキから出る → 移送完了後 deck0 なら refresh)
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed', refreshAfter: true } },
      // レベル8以上のカードを手札に加えた場合、手札を1枚リムーブする
      {
        kind: 'conditional',
        if: { kind: 'boundMatchesFilter', bindKey: '$matched', filter: { levelMin: 8 } },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。その中から【疾風】を持つキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。レベル8以上のカードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B09073: CardDef = {
  id: 'B09073',
  no: '1013/B09073',
  kind: 'character',
  names: ['萩原研二'],
  colors: ['黄'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1775608910217963.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
