// cards/ct-p06/B06032 弁慶 (キャラ) — hirameki optional humanChooser 解禁 exemplar (2026-07-11 Wave C)
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【ヒラメキ】【解決編】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の
//     〚特徴［YAIBA］〛のキャラを1枚まで選び、スリープ状態で登場させる。（自分の事件が解決編になっている場合、
//     この能力か効果を使える）
// 公式Q&A: 手札からリムーブしたカードも選んで登場可 / 現場5枚時はスイッチ登場可 / 効果登場でも【登場時】発動。
//
// 句マッピング (B03085 a1 と同構造 = 【ヒラメキ】版):
//   trigger{hook:'evidence:remove-by-action', optional:true} (【ヒラメキ】発動/不発) + condition caseStatus 解決編 (【解決編】ゲート)
//   effect = optional{chain[discard{player:self,n:1}, sceneEnter 明示pick形 {from:'remove', enterSleep:true,
//     target pick query{area:'remove', side:'self', filter:{trait:'YAIBA', levelMax:5, kind:'character'}, n:0-1}}]}
//   optional=「してもよい」(本 wave で hiramekiResolve humanChooser:true 解禁 → human も decline 可)、
//   chain=「そうした場合」(discard 適用時のみ登場)、enterSleep=「スリープ状態で登場」、max:1=「1枚まで」0可 (rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 【解決編】(自分の事件が解決編) — 未達なら能力を持たない扱い (rules/17)
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 手札を1枚リムーブしてもよい
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        // そうした場合、自分のリムーブエリアにあるレベル5以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、スリープ状態で登場させる
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$pick.cardId',
            from: 'remove',
            viaEffect: true,
            enterSleep: true,
            target: {
              kind: 'pick',
              query: { area: 'remove', side: 'self', filter: { trait: 'YAIBA', levelMax: 5, kind: 'character' } },
              n: { min: 0, max: 1 },
              chooser: 'self',
            },
          },
        },
      ],
    },
  },
  description:
    '【ヒラメキ】【解決編】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、スリープ状態で登場させる。（自分の事件が解決編になっている場合、この能力か効果を使える）',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};

export const B06032: CardDef = {
  id: 'B06032',
  no: '0655/B06032',
  kind: 'character',
  names: ['弁慶'],
  colors: ['緑'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285189445620.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
