// cards/ct-p09/B09097P コルン (character, parallel) — Task A green候補 再author (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト (B09097 と同一):
//   【事件赤＆黒】【事件編】【登場時】手札から【赤】か【黒】のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。この効果によってレベル7以上のカードをリムーブした場合、相手のデッキのカードを上から3枚リムーブする。
// 句マッピングは B09097.ts を参照 (byte-twin、meta のみ差分: id/no/rarity/imageUrl)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件赤＆黒】【事件編】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: ['赤', '黒'], combine: 'and' },
      { kind: 'caseStatus', status: '事件編' },
    ],
  },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から【赤】か【黒】のカードを1枚リムーブしてもよい (bind:$removed)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { color: ['赤', '黒'] }, bind: '$removed' } },
      // そうした場合、カードを2枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      // この効果によってレベル7以上のカードをリムーブした場合、相手のデッキのカードを上から3枚リムーブする
      {
        kind: 'conditional',
        if: { kind: 'boundMatchesFilter', bindKey: '$removed', filter: { levelMin: 7 } },
        then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 3 } },
      },
    ],
  },
  description: '【事件赤＆黒】【事件編】【登場時】手札から【赤】か【黒】のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。この効果によってレベル7以上のカードをリムーブした場合、相手のデッキのカードを上から3枚リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B09097P: CardDef = {
  id: 'B09097P',
  no: '1036/B09097P',
  kind: 'character',
  names: ['コルン'],
  colors: ['黒'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['黒ずくめの組織'],
  rarity: 'CP',
  imageUrl: '1775608943892576.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
