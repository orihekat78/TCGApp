// cards/ct-p08/B08058 宮野志保 (キャラ) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 23-qa-disguise-cutin.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   自分のターン終了時、自分の現場にレベル7のキャラが3枚以上いる場合、カードを1枚引き、
//     相手の現場にいるキャラを1枚まで選び、スタンさせる。
//     （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   【FILE8】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、
//     レベル8以下のスリープ状態かスタン状態のキャラを1枚まで選び、デッキの下に移す。
//
// 句マッピング:
//   - 自分のターン終了時 => trigger {hook:'phase:end:start'} + condition {kind:'turn', player:'self'}
//     (phase:end:start は source 不定 → selfOnly でなく condition で gate。B07072/B05076P 同型)
//   - 自分の現場にレベル7のキャラが3枚以上いる場合 => conditional.if sceneHas {filter:{levelMin:7, levelMax:7}, nMin:3}
//     (「レベル7」= ちょうど7。公式Q&A: 解決時に判定・自身も数える → ability.condition (発火時評価) でなく
//      effect 内 conditional (解決時評価) に置く。rules/25: 発動済み効果は離場しても解決可)
//   - カードを1枚引き => draw n:1 (公式Q&A: 「〜してもよい」ではないので必ず引く → sequence 必須 step)
//   - 相手の現場にいるキャラを1枚まで選び、スタンさせる => sceneSetState {player:'self', side:'opp', max:1, state:'stun'}
//     (「〜まで」= 0枚選択可 = 公式Q&A。スタンの特殊挙動は rules/03 = engine 側処理)
//   - 【FILE8】 => condition fileAtLeast 8 (rules/17。アシスト中のパートナーも数える = 公式Q&A)
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}
//   - このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、〜 =>
//     optional + chain 先頭2 step [sceneSetState $self sleep, discard 1] (PR144 a1 前例。
//     chain: step が no-op なら以降 skip = 「そうした場合」 semantics)
//   - レベル8以下のスリープ状態かスタン状態のキャラを1枚まで選び、デッキの下に移す =>
//     sceneToDeck (Task D E2-a) {player:'self', side:'either', max:1, filter:{levelMax:8}, state:['sleep','stun'], pos:'bottom'}
//     (エリア・所有者指定なし=どちらの現場でも (rules/15)。移動先は移されたキャラ所有者のデッキ下。
//      リムーブでない → 【現場リムーブ時】不発火 (rules/23 流儀))

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
    kind: 'and',
    // BUG-145 (2026-06-15): 既存条件 AND not{charStateIs self sleep} (already-sleep gate, 公式qAndA B04049)
    cs: [
      { kind: 'fileAtLeast', n: 8 },
      { kind: 'not', c: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' } },
    ],
  },
  effect: {
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
  description: '【FILE8】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、レベル8以下のスリープ状態かスタン状態のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/17-icons.md', 'rules/15-abilities-effects.md', 'rules/23-qa-disguise-cutin.md'],
};

export const B08058: CardDef = {
  id: 'B08058',
  no: '0896/B08058',
  kind: 'character',
  names: ['宮野志保'],
  colors: ['赤'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['科学者'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731238670756.jpg',
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
