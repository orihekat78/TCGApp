// cards/pr-01/PR086 伊達航 (character) — engine拡張 wave#2 cluster3 (action-lifecycle trigger, 2026-06-14)
// rules: 03-field-areas.md, 07-action-flow.md, 08-contact.md, 10-action-event.md, 15-abilities-effects.md,
//        17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   effect:   このキャラのアクション終了時、このキャラを現場からデッキの下に移してもよい。そうした場合、
//             カードを1枚引き、手札からレベル6以下の〚特徴［警察］〛のキャラを1枚までスリープ状態で登場させる。
//   hirameki: 【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// 句マッピング:
//   a1: このキャラのアクション終了時 => triggered, scope:'on-scene', trigger{hook:'action:end', selfOnly:true}
//         (cluster3 新 hook。emit=state-machine.ts completed/aborted、source={player,uid}=actor。公式 qAndA
//          「現場を離れる⇒アクション終了 の順で進むので、アクション終了時に現場にいないキャラの能力は発動しない」
//          は in-play scan + selfOnly で自然成立 — 離場 actor は collectCardsInPlay 走査外 / rules/22)
//       ～移してもよい。そうした場合、～ => optional{sequence[...]} (「してもよい。そうした場合」=任意+chain / rules/15)
//       このキャラを現場からデッキの下に移す => sceneToDeck{uid:'$self', pos:'bottom'} ($self=ctx.source.uid)
//       カードを1枚引き => draw{player:'self', n:1}
//       手札からレベル6以下[警察]キャラを1枚までスリープ状態で登場 =>
//         sceneEnter{player:'self', from:'hand', max:1, filter:{levelMax:6, trait:'警察', kind:'character'},
//                    enterSleep:true, viaEffect:true} (0枚可 / 効果による登場=色制限なし rules/20 / スリープ登場 rules/03)
//       qAndA: 登場キャラに本キャラの効果は引き継がれない (【変装】ではない) / 登場時能力は発動する
//              → sceneEnter は通常登場 (enter hook 発火) で自然に整合
//   a2: 【ヒラメキ】(証拠からリムーブされるときに発動 / rules/10) => triggered, scope:'on-evidence',
//         trigger{hook:'evidence:remove-by-action', optional:true} (任意発動)
//       キャラを1枚まで選び、スリープさせる => choice 形 sceneSetState{uid:'$pick', state:'sleep', target pick max1}
//         (D11009 a3 同型 — hirameki fire は hiramekiResolve が $pick を auto 解決するため choice/$pick 明示が必須。
//          短縮形だと fire 時 auto-pick されない / 両現場・0枚可 / rules/03)

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: このキャラのアクション終了時、デッキの下に移してもよい。そうした場合、1ドロー + 手札からLv6以下[警察]を1枚までスリープ登場
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラのアクション終了時 (現場在場時のみ発火 = selfOnly + in-play scan / rules/22)
  trigger: { hook: 'action:end', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        // このキャラを現場からデッキの下に移す
        { kind: 'atom', verb: 'sceneToDeck', args: { uid: '$self', pos: 'bottom' } },
        // カードを1枚引き
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        // 手札からレベル6以下[警察]のキャラを1枚までスリープ状態で登場 (0枚可)
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: { player: 'self', from: 'hand', max: 1, viaEffect: true, enterSleep: true, filter: { levelMax: 6, trait: '警察', kind: 'character' } },
        },
      ],
    },
  },
  description:
    'このキャラのアクション終了時、このキャラを現場からデッキの下に移してもよい。そうした場合、カードを1枚引き、手札からレベル6以下の〚特徴［警察］〛のキャラを1枚までスリープ状態で登場させる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};

// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D11009 a3 同型 choice/$pick)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const PR086: CardDef = {
  id: 'PR086',
  no: '0482/PR086',
  kind: 'character',
  names: ['伊達航'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1737462993157692.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
