// cards/ct-p07/B07019 遠山和葉 (キャラ・解決編/登場時)
// rules: 15-abilities-effects.md, 17-icons.md (§【解決編】/§【登場時】/§enter-source),
//        24-qa-naming-stun.md (§スリープ非対称), 03-field-areas.md
//
// 公式テキスト:
//   【解決編】【登場時】【緑】のイベントの効果によって登場した場合、このキャラをスリープさせてもよい。
//   そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
// 公式Q&A: 【緑】イベント効果でスリープ状態で登場した場合「このキャラをスリープさせてもよい」は行えない (A: いいえ)。
//
// engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled) — B04049 idiom:
//   - listener gate = 解決編 AND 【緑】イベント効果による登場 (enterSource{event,緑})。
//   - mandatory triggerはsleep/stunでも発動し、effect-time active conditionalがoptional全体を抑止 (BUG-145)。
//   - effect = conditional(active) → optional + chain (「そうした場合」= sleep適用時のみ後続remove)。
//   - self-sleep step は **cost ではなく effect atom** sceneSetState{uid:'$self'} (sleepSelf は cost union)。
//   - remove は PA短縮形 (side:'either' / 「1枚まで」= max:1 で 0 可)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' }, // 【解決編】
      { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'event', color: '緑' } }, // 【緑】イベント効果で登場
    ],
  },
  // このキャラをスリープさせてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain', // 「そうした場合」= sleep が適用された場合のみ remove へ (chain は no-apply で break)
        steps: [
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
          { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } } },
        ],
      },
    },
  },
  description: '【解決編】【登場時】【緑】イベント効果で登場した場合、このキャラをスリープしてもよい。そうしたらレベル7以下を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B07019: CardDef = {
  id: 'B07019',
  no: '0751/B07019',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1762413976147341.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};
