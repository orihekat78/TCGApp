// cards/ct-p03/B03046 怪盗キッド (character) — CARD PHASE step12 (opponentRestrict 'stunAutoActivate' 初 consumer、engine変更0)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/15-abilities-effects.md,
//        rules/17-icons.md, rules/24-qa-naming-stun.md
//
// 公式テキスト:
//   【パートナー白】相手の現場にいるスタン状態のキャラはオートフェイズにアクティブにならない。
//   （アクティブ状態かスリープ状態にならないかぎり、スタン状態は解除されない）
//   【登場時】キャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// 句マッピング:
//   - 【パートナー白】=> condition partnerColor{白} (rules/17、条件外は能力を持たない扱い)。
//   - 「相手の現場にいるスタン状態のキャラはオートフェイズにアクティブにならない」=>
//     continuousModifier.opponentRestrict:['stunAutoActivate'] (engine mega-wave W6 step5)。
//     消費 = flow/auto-phase.ts の現場アクティブ化ループが read.char.restrictsOpponent を参照し、
//     stun キャラの「代わりにスリープ化」(rules/03) 自体を skip。公式Q&A「効果によるアクティブ化は
//     妨げられない (代わりにスリープになる)」= auto-phase 限定 gate ゆえ自動整合。
//   - 【登場時】スタン pick => trigger{hook:'enter', selfOnly:true} + sceneSetState 短縮形
//     {max:1, side:'either', state:'stun'} (D08019 a1 同型、state 差替のみ)。
//     エリア指定なし「キャラ」= side:'either' (rules/15)、「1枚まで」= 0枚可。
//     括弧書き = rules/03 スタン挙動の確認的注記 (追加実装なし)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '白' },
  continuousModifier: { opponentRestrict: ['stunAutoActivate'] },
  description:
    '【パートナー白】相手の現場にいるスタン状態のキャラはオートフェイズにアクティブにならない。（アクティブ状態かスリープ状態にならないかぎり、スタン状態は解除されない）',
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', max: 1, side: 'either', state: 'stun' },
  },
  description: '【登場時】キャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B03046: CardDef = {
  id: 'B03046',
  no: '0301/B03046',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['怪盗'],
  rarity: 'SR',
  imageUrl: '1729133385748953.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
