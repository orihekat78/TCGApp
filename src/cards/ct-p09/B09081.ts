// cards/ct-p09/B09081 知苑大哉 (キャラ) — hirameki optional humanChooser 解禁 exemplar (2026-07-11 Wave C)
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにある〚カード名［知苑禄江］〛を
//     1枚まで選び、登場させる。
//   【ヒラメキ】手札を1枚リムーブしてもよい。そうした場合、アクション中のキャラを1枚まで選び、スタンさせる。
// 公式Q&A: 手札からリムーブしたカードも選んで登場可 / 現場5枚時はスイッチ登場可 (登場した本キャラもリムーブ可) /
//   「アクション中のキャラ」= アクション[事件] で本ヒラメキを発動させた actor ($trigger.byUid) / 発動キャラを
//   スタンさせても手順に影響なし (証拠獲得まで進む) / スタン = 上下逆向き (アクティブ化で代わりにスリープ)。
//
// 句マッピング:
//   a1 【登場時】= B03085 a1 同型 (revive from remove、enterSleep 無し=通常登場)。
//     trigger{hook:'enter', selfOnly:true} + effect optional{chain[discard{n:1}, sceneEnter 明示pick形
//     {from:'remove', viaEffect:true, target pick query{area:'remove', side:'self', filter:{cardName:'知苑禄江',
//     kind:'character'}, n:0-1}}]}。optional=「してもよい」、chain=「そうした場合」、max:1=「1枚まで」0可。
//   a2 【ヒラメキ】= optional{chain[discard{n:1}, sceneSetState{uid:'$trigger.byUid', state:'stun'}]}。
//     outer optional=「手札を1枚リムーブしてもよい」(本 wave の hiramekiResolve humanChooser:true で human も decline 可)、
//     chain=「そうした場合」、sceneSetState $trigger.byUid=「アクション中のキャラ」(wave-11 actor payload、B03085 a2 と同 ref)。
//     「1枚まで選び」の 0可 は outer optional decline (= discard しない) が担う。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 手札を1枚リムーブしてもよい
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        // そうした場合、自分のリムーブエリアにある〚カード名［知苑禄江］〛を1枚まで選び、登場させる
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$pick.cardId',
            from: 'remove',
            viaEffect: true,
            target: {
              kind: 'pick',
              query: { area: 'remove', side: 'self', filter: { cardName: '知苑禄江', kind: 'character' } },
              n: { min: 0, max: 1 },
              chooser: 'self',
            },
          },
        },
      ],
    },
  },
  description:
    '【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにある〚カード名［知苑禄江］〛を1枚まで選び、登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 手札を1枚リムーブしてもよい
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        // そうした場合、アクション中のキャラ ($trigger.byUid) を1枚まで選び、スタンさせる
        { kind: 'atom', verb: 'sceneSetState', args: { uid: '$trigger.byUid', state: 'stun' } },
      ],
    },
  },
  description:
    '【ヒラメキ】手札を1枚リムーブしてもよい。そうした場合、アクション中のキャラを1枚まで選び、スタンさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B09081: CardDef = {
  id: 'B09081',
  no: '1021/B09081',
  kind: 'character',
  names: ['知苑大哉'],
  colors: ['黄'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608910340473.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/24-qa-naming-stun.md',
  ],
};
