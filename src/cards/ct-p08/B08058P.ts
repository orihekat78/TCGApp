// cards/ct-p08/B08058P 宮野志保 (キャラ, パラレル CP) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 23-qa-disguise-cutin.md, 25-qa-effects-resolution.md
//
// B08058 のパラレル (CP)。公式テキスト・Q&A は B08058 と同一。id / no / rarity / imageUrl のみ P 版データ。
//
// 公式テキスト:
//   自分のターン終了時、自分の現場にレベル7のキャラが3枚以上いる場合、カードを1枚引き、
//     相手の現場にいるキャラを1枚まで選び、スタンさせる。
//     （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   【FILE8】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、
//     レベル8以下のスリープ状態かスタン状態のキャラを1枚まで選び、デッキの下に移す。
//
// 句マッピング:
//   - 自分のターン終了時 => trigger {hook:'phase:end:start'} + condition turn self
//   - 自分の現場にレベル7のキャラが3枚以上いる場合 => conditional.if sceneHas {filter:{levelMin:7, levelMax:7}, nMin:3} (Q&A: 解決時判定)
//   - カードを1枚引き => draw n:1 (必ず引く) / 相手の現場〜1枚まで選びスタン => sceneSetState {side:'opp', max:1, state:'stun'}
//   - 【FILE8】【登場時】 => condition fileAtLeast 8 + trigger enter selfOnly
//   - このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合〜 => optional + chain (PR144 前例)
//   - レベル8以下のスリープ/スタン状態のキャラを1枚まで選びデッキの下に => sceneToDeck {side:'either', max:1, filter:{levelMax:8}, state:['sleep','stun'], pos:'bottom'}

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  // 自分のターン終了時 (phase:end:start は両ターン発火 → turn self で gate)
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    // 自分の現場にレベル7のキャラが3枚以上いる場合 (Q&A: 解決時判定・このキャラ自身も数える)
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelMin: 7, levelMax: 7 } }, nMin: 3 },
    then: {
      kind: 'sequence',
      steps: [
        // カードを1枚引き (Q&A: 必ず引く)
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        // 相手の現場にいるキャラを1枚まで選び、スタンさせる (0枚選択可)
        { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'opp', state: 'stun' } },
      ],
    },
  },
  description: '自分のターン終了時、自分の現場にレベル7のキャラが3枚以上いる場合、カードを1枚引き、相手の現場にいるキャラを1枚まで選び、スタンさせる。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/03-field-areas.md', 'rules/25-qa-effects-resolution.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // 【FILE8】 (rules/17。アシスト中のパートナーも数える = 公式Q&A)
  condition: {
    kind: 'fileAtLeast',
    n: 8,
  },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
        // このキャラをスリープさせ
        { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
        // 手札を1枚リムーブしてもよい
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        // そうした場合、レベル8以下のスリープ状態かスタン状態のキャラを1枚まで選び、デッキの下に移す
        { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, filter: { levelMax: 8 }, state: ['sleep', 'stun'], pos: 'bottom' } },
        ],
      },
    },
  },
  description: '【FILE8】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、レベル8以下のスリープ状態かスタン状態のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/17-icons.md', 'rules/15-abilities-effects.md', 'rules/23-qa-disguise-cutin.md'],
};

export const B08058P: CardDef = {
  id: 'B08058P',
  no: '0896/B08058P',
  kind: 'character',
  names: ['宮野志保'],
  colors: ['赤'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['科学者'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1770878984746905.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
