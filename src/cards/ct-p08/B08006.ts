// cards/ct-p08/B08006 小嶋元太 (character) — engine mega-wave W4 r7 exemplar (handStackUnder cost, 2026-07-03)
// rules: 10-action-event.md (ヒラメキ), 15-abilities-effects.md, 16-card-set.md (重ねる),
//        21-declared-ability-cost.md, 24-qa-naming-stun.md (スタン)
//
// 公式テキスト:
//   【宣言】【スリープ】〚手札から特徴［少年探偵団］のキャラを1枚公開し、自分の現場にいる【青】の
//   キャラ1枚の下に重ねる〛：レベル7以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。
//
// a1: cost = pay[sleepSelf, handStackUnder (W4 r7)]。「公開し」= hand:reveal emit (移動前、
//     revealHandToDeckTop と同契約)。公式Q&A: 公開したカードをこのキャラ自身の下に重ねることも可
//     (hostTarget filter 青 = 自身も候補)。effect = sceneRemove side:'either' levelMax:7 (rules/15)。
// a2: ヒラメキ = evidence:remove-by-action + $trigger.byUid (wave-11 actor payload、B05032 a2 byte 同型)。
//     【解決編】= condition caseStatus。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'always',
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      {
        kind: 'handStackUnder',
        // 手札から特徴［少年探偵団］のキャラを1枚公開し
        cardTarget: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { kind: 'character', trait: '少年探偵団' } }, n: { min: 1, max: 1 }, chooser: 'self' },
        // 自分の現場にいる【青】のキャラ1枚の下に重ねる
        hostTarget: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { kind: 'character', color: '青' } }, n: { min: 1, max: 1 }, chooser: 'self' },
      },
    ],
  },
  // レベル7以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMax: 7 }, cause: 'effect' } },
  description: '【宣言】【スリープ】〚手札から特徴［少年探偵団］のキャラを1枚公開し、自分の現場にいる【青】のキャラ1枚の下に重ねる〛：レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // アクション中のキャラ (= '$trigger.byUid'、wave-11 actor payload) をスタン
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$trigger.byUid', state: 'stun' } },
  description: '【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B08006: CardDef = {
  id: 'B08006',
  no: '0847/B08006',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731562374131.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
