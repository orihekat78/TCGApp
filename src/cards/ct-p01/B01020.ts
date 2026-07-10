// cards/ct-p01/B01020 毛利小五郎 (character) — DEFER解禁 (B04072 clone, untargetableByActionAura、engine変更0)
// rules: rules/03-field-areas.md, rules/07-action-flow.md, rules/10-action-event.md,
//        rules/15-abilities-effects.md, rules/17-icons.md, rules/24-qa-naming-stun.md
//
// 公式テキスト:
//   このキャラがスリープ状態の場合、相手は自分の現場にいるレベル4以下のキャラを指定してアクションできない。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// 句マッピング:
//   - 「このキャラがスリープ状態の場合」=> continuous ability.condition charStateIs{ref:self, state:'sleep'}
//     (rules/24 常時有効型 = 条件成立中のみ効果あり)。公式Q&A「スタン状態の場合は条件を満たしていません」=
//     charStateIs は === 単一比較 (cond/eval.ts) で stun ≠ sleep → 自動整合。
//   - 「相手は自分の現場にいるレベル4以下のキャラを指定してアクションできない」=>
//     continuousModifier.untargetableByActionAura: {levelMax:4}
//     (engine mega-wave W6 step5 r50 — read/char.ts auraUntargetableByAction が bearer 同 side scene を
//     walk し ability.condition honor、消費 = target-expander.candidates() 負 filter)。
//     B04072 白鳥任三郎 (同型文、{levelMax:5, color:['青','黄']}) から color を外し levelMax のみ (色制限なし)。
//     「自分の現場にいる」= aura reader は target と bearer が **同 side** で候補除外 (「自分」= B01020 controller
//     = target 側、「相手」= action する側 = 通常の所有者視点)。matchOneFilter は color 未指定なら level のみ AND。
//     公式Q&A「レベル4以下のキャラでガードすることは可能」= guard 経路は candidates() 非経由 → 自動整合。
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）=> type:'triggered', scope:'on-evidence',
//     trigger {hook:'evidence:remove-by-action', optional:true} (canonical ヒラメキ encoding →
//     pendingHirameki side-channel で fire/skip を UI/AI に委譲。D01012 a2 / D08019 a2 同型)。
//   - 「キャラを1枚まで選び、スリープさせる」=> sceneSetState{state:'sleep'} 短縮形 pick
//     {area:'scene', side:'either', n:{min:0,max:1}, chooser:'self'} (D01012 a2 VERBATIM 同型)。
//     エリア指定なし「キャラ」= side:'either' 双方の現場 (rules/15)、「1枚まで」= n.min:0 (0枚可)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 「このキャラがスリープ状態の場合」(常時有効型、rules/24)
  condition: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' },
  continuousModifier: {
    // 「相手は自分の現場にいるレベル4以下のキャラを指定してアクションできない」(色制限なし = levelMax のみ)
    untargetableByActionAura: { levelMax: 4 },
  },
  description:
    'このキャラがスリープ状態の場合、相手は自分の現場にいるレベル4以下のキャラを指定してアクションできない。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/07-action-flow.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】（証拠からリムーブされるときに発動する）
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // キャラを1枚まで選び、スリープさせる
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B01020: CardDef = {
  id: 'B01020',
  no: '0016/B01020',
  kind: 'character',
  names: ['毛利小五郎'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['探偵', '毛利探偵事務所'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714012985529336.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
