// cards/pr-01/PR042 鈴木園子 (キャラ) — engine拡張 wave#2 cluster14 (multi-card sceneEnter, 2026-06-15)
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー青】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにある
//   レベル4以下の〚特徴［少年探偵団］〛のキャラを2枚まで選び、スリープ状態で登場させる。
//
// 句マッピング (engine拡張 wave#2 cluster14):
//   - 【パートナー青】 => condition partnerColor青 / 【登場時】 => trigger enter selfOnly。
//   - 「手札を1枚リムーブしてもよい。そうした場合、…」 => chain[ discard max:1, …](D01004 同型・step1 適用時のみ step2)。
//   - 「Lv4以下[少年探偵団]を2枚まで スリープ状態で登場」 => sceneEnter multi-card 契約 (cardIds:'$pick.cardIds'、
//     n:{min:0,max:2}、enterSleep:true、filter levelMax:4)。現場満杯時は switchRemoveUids[] で switch (rules/20)。
//   - 後続 step が無いため skipResolvesAtom 不要 (0枚登場=何もしない)。公式Q&A: 登場直後の園子自身も switch でリムーブ可。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '青' }, // 【パートナー青】
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい (任意)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、Lv4以下[少年探偵団]を2枚まで スリープ状態で登場 (step1 適用時のみ)
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', from: 'remove', cardIds: '$pick.cardIds', enterSleep: true, viaEffect: true,
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団', levelMax: 4 } },
            n: { min: 0, max: 2 }, chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【パートナー青】【登場時】手札1枚リムーブしてもよい。そうした場合 リムーブのLv4以下[少年探偵団]を2枚までスリープ登場。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const PR042: CardDef = {
  id: 'PR042',
  no: '0400/PR042',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1727333980428186.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
