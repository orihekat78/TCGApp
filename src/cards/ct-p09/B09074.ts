// cards/ct-p09/B09074 松田陣平 (character) — wave reveal-handadd (engine変更0)
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p09/character.tsv col11):
//   【疾風】カードを1枚引く。（自分の現場にこのターンで1番に登場したときに発動する）
//   【登場時】自分のデッキのカードを上から4枚見る。その中から【疾風】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//
// 句マッピング (exemplar = D11003 a1 (疾風) / B05016 a1 (deck-look maxN→hand)):
//   a1【疾風】: trigger{hook:'enter', selfOnly:true, matcherCondition:{kind:'enterOrderEquals', n:1}} → draw{n:1}
//       ※ 能力/効果による登場でも・相手ターン中でも条件満たせば発火 (rules/17 §疾風 / 公式QA)。
//   a2【登場時】: trigger{hook:'enter', selfOnly:true} (matcherCondition なし)
//       ※ a1(疾風)と同 hook → 同タイミング2能力発火、ターンプレイヤーが好きな順で解決 (公式QA、engine native)。
//   - 上から4枚見る + 【疾風】を持つキャラを1枚まで公開して手札に加え
//       => deckRevealUntil{chooseMatch:'upTo', maxN:4, filter:{keyword:'疾風', kind:'character'}} → cond($matched) handAddFromDeck
//       ※ filter.keyword:'疾風' = defHasKeyword(abilityIsShippu) 印字静的判定 (能力有効性は問わない、公式QA)。「のキャラ」= kind:'character'。
//   - 残りを好きな順番でデッキの下に移す => deckToBottomBound{$revealed} (owner が並び順決定)
//   - カードを手札に加えた場合、手札を1枚リムーブする => conditional(bound $matched matched) → discard{n:1}
//       ※「加えた場合」guard を conditional 内側に置き no-match 時 over-fire 防止 (B07086 教訓)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【疾風】カードを1枚引く。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { chooseMatch: 'upTo', player: 'self', maxN: 4, filter: { keyword: '疾風', kind: 'character' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から4枚見る。その中から【疾風】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B09074: CardDef = {
  id: 'B09074',
  no: '1014/B09074',
  kind: 'character',
  names: ['松田陣平'],
  colors: ['黄'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1775608910236075.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
