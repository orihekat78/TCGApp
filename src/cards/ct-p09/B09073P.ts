// cards/ct-p09/B09073P 萩原研二 (キャラ・パラレル) — engine拡張 wave#2 cluster2 (2026-06-12)
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト (B09073 と同一効果。P 版は rarity/imageUrl/no のみ異なる — effect/cutIn/hirameki/henso 完全一致を TSV で確認済):
//   【宣言】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。
//     この能力は自分の現場に【疾風】を持つキャラがいる場合に宣言できる。
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。
//     その中から【疾風】を持つキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。
//     レベル8以上のカードを手札に加えた場合、手札を1枚リムーブする。
//
// 句マッピング: B09073.ts と同一 (同テキスト別ファイル full def 慣行 — B04068P 同様)。
//   a1: 【宣言】【スリープ】cost sleepSelf + 宣言可条件 sceneHas{side:'self', filter:{keyword:'疾風'}} + sceneRemove{apMax:8000, max:1, side:'either'}
//   a2: 相手ターン中・現リム時 sequence: deckRevealUntil(upTo, maxN:3, {keyword:'疾風', kind:'character'})
//       → handAddFromDeck → boundToRemove(X6) → boundMatchesFilter(levelMin:8) で discard1 (句順 pin: handAdd→boundToRemove→条件discard)

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
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      // 残りの公開カードをリムーブエリアに移す (X6。ここで初めてデッキから出る → 移送完了後 deck0 なら refresh)
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
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

export const B09073P: CardDef = {
  id: 'B09073P',
  no: '1013/B09073P',
  kind: 'character',
  names: ['萩原研二'],
  colors: ['黄'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1775608910227702.jpg',
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
