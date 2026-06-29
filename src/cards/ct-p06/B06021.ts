// cards/ct-p06/B06021 石川五右衛門 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/10-action-event.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）\nこのキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる） => CardDef.keywords: ['突撃[事件]'] (innate printed keyword, NOT a granted ability) [Innate unconditional printed 突撃[X] icons live in CardDef.keywords[] — exemplars src/cards/ct-p05/B05030.ts:55 keywords:['突撃[キャラ]'], ct-p09/B09037.ts:51, ct-p08/B08032.ts:74. Engine honors 突撃[事件] for the naming-state exception: src/engine/flow/main/action.ts:56 `if (targetKind==='case' && kws.includes('突撃[事件]')) return true;` (namedExceptionAllowed). keywords read via read/keyword.ts (CardDef.keywords[]). Parenthetical is gloss only. Pure JSON, no closure.]
//   - このキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く。 => AbilityDef a1 = triggered{scope 'on-scene', trigger {hook 'evidence:gain', selfOnly:true}} + draw{player:'self', n:1} [WORD-FOR-WORD identical to shipped exemplar src/cards/ct-p08/B08012.ts a2 (比護隆佑): same description text, trigger {hook 'evidence:gain', selfOnly:true}, effect draw{player:'self', n:1}. evidence:gain IS card-triggerable (cluster3, 2026-06-13): registered in src/engine/listeners/triggered.ts:99 TRIGGERED_HOOKS, emitted ONLY at src/engine/flow/action-case.ts:111 gainSelfEvidence (rules/10 手順3, actual-gain only — 推理/効果/refresh do NOT emit, which structurally guarantees 'アクション[事件]によって'). source={player, uid:byUid}=the actor; selfOnly matches source.uid='このキャラ'. Actor sleeps on action[事件] declare and stays on scene → in-play scan reaches it (B08012/B01067 comments confirm). cap-map.txt lists evidence:gain as INTERNAL-ONLY but is STALE (2026-06-06); brief overrides + live triggered.ts:99 confirms registration.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => AbilityDef a2 = triggered{scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}} + draw{player:'self', n:1} [WORD-FOR-WORD identical to shipped exemplar src/cards/ct-d01/D01006.ts a3 (毛利蘭): same description, scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect draw{player:'self', n:1}. Hirameki encoding confirmed in capability-map (line 333) and brief: type 'triggered' + hook 'evidence:remove-by-action' + optional:true + scope 'on-evidence'. Handled by src/engine/listeners/triggered.ts handleEvidenceRemovedHook; optional:true routes fire/skip to hirameki side-channel (UI/AI). Effect after firing = deterministic draw 1.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'evidence:gain',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: 'このキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/07-action-flow.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B06021: CardDef = {
  id: 'B06021',
  no: '0644/B06021',
  kind: 'character',
  names: [
    '石川五右衛門'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  ap: 5000,
  lp: 0,
  traits: [
    'YAIBA'
  ],
  rarity: 'C',
  imageUrl: '1754284680636259.jpg',
  keywords: [
    '突撃[事件]'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
