// cards/ct-p04/B04089 ベルモット (character) — attribution mini-wave ① byPlayer opp-side 観測型 (2026-07-10)
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【パートナー黒】【自分ターン中】【ターン1】自分の能力や効果によって相手の現場にいるキャラをリムーブ
//   したとき、このキャラをスリープさせてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
// 公式Q&A (character.tsv B04089):
//   Q: 相手の現場のキャラをコンタクトによってリムーブしたとき発動? A: いいえ。コンタクトによるリムーブでは発動しない。
//   Q: 発動条件を満たしたがスリープさせなかった。同ターンもう一度条件を満たしたらスリープ+リムーブできる?
//      A: いいえ。【ターン1】がすでに一度発動しているので、そのターン中は条件を満たしても発動しない。
//   Q: スリープ/スタン状態のこのキャラをスリープさせられる? A: いいえ、アクティブ状態でなければ「スリープさせる」ことはできない。
//   Q: 同じカードが複数現場にいる場合すべて同時に発動? A: はい。すべて同時に発動し好きな順で解決。
//
// 句マッピング:
//   - 【パートナー黒】=> condition partnerColor{黒} (D04002 idiom, rules/17【パートナー(色)】)。
//   - 【自分ターン中】=> condition turn{self} (rules/17)。
//   - 【ターン1】=> limit{turn,1} (rules/17)。opt-out でも発動済扱いで消費 (Q&A) — optional は effect 側。
//   - 自分の能力や効果によって相手の現場にいるキャラをリムーブしたとき
//       => trigger{hook:'leave:to-remove'} + condition removedCharMatches{side:'opp',cause:'effect',byPlayer:'self'}。
//       byPlayer:'self' = リムーブを起こした効果 owner が自分 (payload.byPlayer===ctx.source.player、
//       cond/eval.ts:731-735)。emit 配線 = mutate/scene.ts:334 (atom-handlers/scene.ts:338 が ctx.source.player を渡す)。
//       cause:'effect' 併記 = DSL 規約 (types/effect.ts:186)。コンタクト由来 (cause:'contact-ap') は非発火 = Q&A と整合。
//       「自分の能力や効果によって」= 特定カード限定でないので by:'self' (contact-winner uid 自己限定) は使わない。
//   - このキャラをスリープさせてもよい。そうした場合、… => effect optional{ chain[ sceneSetState{$self,sleep}, sceneRemove ] }。
//       B04092 (同package 同 idiom) 準拠。「してもよい」= optional (opt-in/out)。「そうした場合」= sleep が適用された場合のみ後続。
//       mandatory trigger はsleep/stunでも発動し、effect-time charStateIs(self,active) がoptional全体を抑止する (BUG-145)。
//   - レベル7以下のキャラを1枚まで選び、リムーブする => sceneRemove 短縮形{player:'self', max:1, side:'either', filter:{levelMax:7}}。
//       max:1 = 「1枚まで」(0 可、rules/15)。side:'either' = エリア指定なしの「キャラ」= どちらの現場でも選べる (rules/15)。D04002 idiom。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
  },
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黒' },
      { kind: 'turn', player: 'self' },
      { kind: 'removedCharMatches', side: 'opp', cause: 'effect', byPlayer: 'self' },
    ],
  },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain', // 「そうした場合」= sleep が適用された場合のみ sceneRemove へ (chain は no-apply で break)
        steps: [
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
          { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
        ],
      },
    },
  },
  description:
    '【パートナー黒】【自分ターン中】【ターン1】自分の能力や効果によって相手の現場のキャラをリムーブしたとき、このキャラをスリープしてもよい。そうしたらレベル7以下のキャラを1枚までリムーブ。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};

export const B04089: CardDef = {
  id: 'B04089',
  no: '0471/B04089',
  kind: 'character',
  names: ['ベルモット'],
  colors: ['黒'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1735287841299257.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
