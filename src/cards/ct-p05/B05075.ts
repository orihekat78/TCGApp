// cards/ct-p05/B05075 勝又力 (character) — engine変更0 exemplar WB2 (2026-07-11)
// rules: 05-turn-phases.md, 11-reasoning.md, 14-refresh.md, 15-abilities-effects.md,
//        16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   自分のターンのメインフェイズ開始時、このキャラにセットされているカードを1枚リムーブしてもよい。
//     そうした場合、証拠を1つ得る。
//   【宣言】【スリープ】：自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//
// 句マッピング:
//   - a1「自分のターンのメインフェイズ開始時、…」=> triggered phase:main:start + matcherCondition
//     triggerPlayerIs{side:'self'} (B05072 a1 同型。emit=flow/turn.ts オートフェイズ完了後、公式Q&A)。
//   - a1「このキャラにセットされているカードを1枚リムーブしてもよい。そうした場合、証拠を1つ得る」=>
//     optional{ chain[ charRemoveSetCard{uid:'$self', bind:'$removed'} (B02087 A3 wave の bind arg),
//                      conditional{if bound $removed matched, then evidenceGain{n:1}} ] }。
//     「してもよい」= optional wrapper 必須 (rules/15: しない選択可。D04007 が確立 idiom —
//     human は する/しない modal、AI は auto-skip)。「そうした場合」= bind presence gate。
//     Q&A「2枚以上でも1枚のみ・1証拠」= chain 1回。
//     ★T2 review BLOCK 反映 (night-wB): 旧実装は bare chain で human の decline 権を剥奪していた。
//   - a2「【宣言】【スリープ】：自分のデッキのカードを上から1枚裏向きでこのキャラにセットする」=>
//     declared, cost sleepSelf, charSetCard{uid:'$self', fromDeckTop:true, faceUp:false, player:'self'}
//     (B02018 a2 同型、cost だけ sleepSelf・limit 無)。

import type { AbilityDef, CardDef } from '@/engine/types';

// 自分メインフェイズ開始時: セットカード1枚リムーブ → そうした場合 証拠1
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'phase:main:start', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } },
  effect: {
    // 「してもよい」= optional (rules/15、D04007 idiom。T2 review BLOCK 反映)
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'charRemoveSetCard', args: { uid: '$self', bind: '$removed' } },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$removed', presence: 'matched' },
          then: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
        },
      ],
    },
  },
  description:
    '自分のターンのメインフェイズ開始時、このキャラにセットされているカードを1枚リムーブしてもよい。そうした場合、証拠を1つ得る。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

// 【宣言】【スリープ】：自分のデッキ上端を裏向きでこのキャラにセット
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
  description: '【宣言】【スリープ】：自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B05075: CardDef = {
  id: 'B05075',
  no: '0575/B05075',
  kind: 'character',
  names: ['勝又力'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['棋士'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628078713135.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/21-declared-ability-cost.md',
  ],
};
