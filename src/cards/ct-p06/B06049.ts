// cards/ct-p06/B06049 佐々木小次郎 (character) — engine拡張 wave#2 cluster8 (ヒラメキ抑止窓)
// rules: 17-icons.md (【登場時】), 13-keywords.md (突撃), 07-action-flow.md / 10-action-event.md (アクション[事件]/ヒラメキ),
//        22-qa-action-contact.md (アクション宣言時=ガード判定前に発動), 15-abilities-effects.md, 03-field-areas.md
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外の〚特徴［YAIBA］〛のキャラがいる場合、ターン終了時までこのキャラは〚突撃〛を持つ。
//   このキャラがアクション［事件］したとき、アクション終了時まで相手の【ヒラメキ】は発動しない。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - a1 【登場時】…[YAIBA]がいる場合、ターン終了時まで〚突撃〛 => enter+conditional{ sceneHas[YAIBA,side:self,excludeSelf,nMin:1]
//        → charGrantKeyword{$self,突撃,scope:turn} } [D08011 a1 と完全同型、trait のみ YAIBA。qAndA: 登場時点で条件
//        判定・後で YAIBA が消えても突撃は失わない (turn-scope grant)]
//   - a2 このキャラがアクション[事件]したとき、アクション終了時まで相手の【ヒラメキ】発動しない
//        => triggered{action:declare, selfOnly} + matcherCondition triggerActionKind{v:'case'} → atom setHiramekiSuppress{player:'opp'}
//        [trigger は D04005 同型 (action:declare + triggerActionKind case)。selfOnly='このキャラ'。
//         setHiramekiSuppress は cluster8 新 verb: turnState[相手].hiramekiSuppressed=true (action-scoped)。
//         listeners/triggered.ts handleEvidenceRemovedHook が抑止、state-machine action-end で清掃]
//   - a3 【ヒラメキ】キャラ1枚までスリープ => triggered{evidence:remove-by-action,optional} → sceneSetState{$pick,sleep,
//        target:pick[scene,either,0-1,self]} [PR138 a2 と同テキスト・同型]

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【登場時】このキャラ以外の[YAIBA]がいる場合、ターン終了時まで〚突撃〛 (D08011 a1 同型、trait=YAIBA)
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場にこのキャラ以外の[YAIBA]がいる場合、
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'YAIBA' }, excludeSelf: true }, nMin: 1 },
    // ターン終了時までこのキャラは〚突撃〛を持つ。
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  },
  description: '【登場時】自分の現場にこのキャラ以外の〚特徴［YAIBA］〛のキャラがいる場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/17-icons.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};

// a2: このキャラがアクション[事件]したとき、アクション終了時まで相手の【ヒラメキ】は発動しない (cluster8 新機構)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 「このキャラがアクション[事件]したとき」= action:declare + selfOnly (このキャラ) + triggerActionKind case (事件)。
  // rules/22: アクション宣言・対象指定・actor スリープ時点で発動 (ガード判定より前) → action:declare hook が正。
  trigger: { hook: 'action:declare', selfOnly: true, matcherCondition: { kind: 'triggerActionKind', v: 'case' } },
  // アクション終了時まで相手の【ヒラメキ】は発動しない → turnState[相手].hiramekiSuppressed=true。
  effect: { kind: 'atom', verb: 'setHiramekiSuppress', args: { player: 'opp' } },
  description: 'このキャラがアクション［事件］したとき、アクション終了時まで相手の【ヒラメキ】は発動しない。',
  ruleRefs: ['rules/10-action-event.md', 'rules/22-qa-action-contact.md', 'rules/13-keywords.md'],
};

// a3: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (PR138 a2 同テキスト・同型)
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B06049: CardDef = {
  id: 'B06049',
  no: '0670/B06049',
  kind: 'character',
  names: ['佐々木小次郎'],
  colors: ['白'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1754285220462312.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/17-icons.md',
    'rules/13-keywords.md',
    'rules/10-action-event.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/03-field-areas.md',
  ],
};
