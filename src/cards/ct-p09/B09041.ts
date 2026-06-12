// cards/ct-p09/B09041 京極真 (キャラ) — Task D batch (2026-06-12)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   〚突撃〛（名乗り状態でもアクションできる）
//   このキャラのアクションがレベル6以下のキャラによってガードされたとき、アクション終了時まで
//     そのキャラに「このキャラはコンタクトによってリムーブされない。」を与える。
//   【宣言】【ターン1】レベル7以上のキャラを1枚まで選び、リムーブする。
//     この能力は、このターン中にこのキャラのアクションがガードされていた場合に宣言できる。
//
// 句マッピング:
//   keywords: ['突撃'] — 名乗り例外 (rules/13)
//   a1: 「このキャラのアクションが…ガードされたとき」= trigger {hook:'action:guarded', selfOnly:true}
//       (action:guarded の source.uid = アクション宣言キャラ) + 「レベル6以下のキャラによって」=
//       matcherCondition triggerCharMatches{payloadKey:'guardUid', filter:{levelMax:6}} (payload.guardUid を評価)
//       → 「アクション終了時までそのキャラに『コンタクトによってリムーブされない。』を与える」=
//       charSetTurnEffect{uid:'$trigger.guardUid', key:'contactImmune_action'} ('_action' suffix =
//       アクション終了時に clearTurnEffects('action') で清掃。rules/22: AP判定リムーブのみ免疫、
//       カットイン等の直接リムーブは貫通 — 公式Q&A同旨)
//   a2 (helper): a3 の宣言条件「このターン中にこのキャラのアクションがガードされていた場合」の記録。
//       action:guarded selfOnly → charSetTurnEffect{uid:'$self', key:'wasGuardedThisTurn'}
//       (clearTurnEffects('turn') が 'wasGuardedThisTurn' を明示清掃 = 「このターン中」)
//   a3: 【宣言】【ターン1】= type:'declared' + limit{turn,1}。宣言条件 = condition charTurnEffect{key:'wasGuardedThisTurn'}
//       (canDeclaredAbility が ctx.source.uid の turnEffects を評価)。「レベル7以上のキャラを1枚まで選び、
//       リムーブする」= sceneRemove 短縮形 (side:'either' — 側指定なしはどちらの現場でも rules/15、max:1 = 0枚可)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:guarded', selfOnly: true, matcherCondition: { kind: 'triggerCharMatches', payloadKey: 'guardUid', filter: { levelMax: 6 } } },
  // アクション終了時までそのキャラ (ガードしたレベル6以下のキャラ) に「このキャラはコンタクトによってリムーブされない。」を与える
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$trigger.guardUid', key: 'contactImmune_action', val: true } },
  description: 'このキャラのアクションがレベル6以下のキャラによってガードされたとき、アクション終了時までそのキャラに「このキャラはコンタクトによってリムーブされない。」を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/22-qa-action-contact.md'],
};

// a3 の宣言条件用 helper: このキャラのアクションがガードされた事実を turnEffects に記録する。
// 'wasGuardedThisTurn' は clearTurnEffects('turn') の明示清掃対象 (engine/mutate/char.ts) = ターン終了で消える。
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:guarded', selfOnly: true },
  // (内部) このターン中にこのキャラのアクションがガードされたことを記録 (a3 の宣言条件参照用)
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'wasGuardedThisTurn', val: true } },
  description: '(内部処理) このターン中にこのキャラのアクションがガードされたことを記録する (宣言能力の条件判定用)。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // この能力は、このターン中にこのキャラのアクションがガードされていた場合に宣言できる
  condition: { kind: 'charTurnEffect', key: 'wasGuardedThisTurn' },
  // レベル7以上のキャラを1枚まで選び、リムーブする (側指定なし = どちらの現場でも rules/15)
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMin: 7 }, cause: 'effect' } },
  description: '【宣言】【ターン1】レベル7以上のキャラを1枚まで選び、リムーブする。この能力は、このターン中にこのキャラのアクションがガードされていた場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09041: CardDef = {
  id: 'B09041',
  no: '0984/B09041',
  kind: 'character',
  names: ['京極真'],
  colors: ['白'],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: ['高校生', '空手家'],
  keywords: ['突撃'],
  rarity: 'C',
  imageUrl: '1775608856093087.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
