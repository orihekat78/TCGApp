// cards/ct-p09/B09102 毒島桐子 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md, rules/19-special-rules.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分の現場に〚特徴［黒ずくめの組織］〛のキャラがいる場合、AP3000以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分の現場に〚特徴［黒ずくめの組織］〛のキャラがいる場合、AP3000以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】 (a1 trigger shell) => trigger:{hook:'leave:to-remove',selfOnly:true} + condition turn:opp (and-combined) [leave:to-remove hook card-triggerable + selfOnly + condition turn:opp shell EXACT twin of src/cards/ct-p03/B03018.ts a1 and src/cards/ct-p08/B08089.ts a1 (both 【相手ターン中】【現場リムーブ時】). handleLeaveToRemoveSelf (src/engine/listeners/triggered.ts:407-458) builds virtual scene CardLocation, honors selfOnly (selfOnlyMatches) and evaluates ability.condition via evalCond before queueing. capability-map hooks: leave:to-remove (現場リムーブ時 any cause), source.uid=leaving uid → selfOnly ✅.]
//   - 自分の現場に〚特徴［黒ずくめの組織］〛のキャラがいる場合 (a1 + a2 gating condition) => condition sceneHas{query:{area:'scene',side:'self',filter:{trait:'黒ずくめの組織'}},nMin:1} [sceneHas trait-on-own-scene condition shape EXACT twin of src/cards/ct-p03/B03054.ts a1 (sceneHas{query:{area:'scene',side:'self',filter:{cardName,levelMin}},nMin:1}) and src/cards/ct-d11/D11003.ts a2 (sceneHas{query:{area:'scene',side:'self',filter:{trait:'警察'}},nMin:2}). capability-map conditions: sceneHas = candidates(query) count >= nMin, full TargetQuery (area/side/filter) power. trait filter honored by matchOneFilter (TargetFilter.trait OR-membership). Note 毒島桐子 self-trait is 泥参会 (NOT 黒ずくめ) so condition requires a DISTINCT black-org char; for a1 the leaving card is already off-scene at handler time (mutate/scene.ts emits AFTER removal) — but it never had the trait, so the predicate correctly checks remaining own-scene chars.]
//   - 【相手ターン中】... + ...の場合 combined (a1 compound condition) => condition and([turn:opp, sceneHas{...}]) [and-composition of two conditions EXACT twin of src/cards/ct-p05/B05109.ts a1 (and([partnerColor,caseStatus])) and src/cards/ct-p07/B07094.ts a1 (and([turn:self,partnerColor])). capability-map conditions: and{cs} = .every. ability.condition evaluated on leave:to-remove path (triggered.ts:436).]
//   - AP3000以下のキャラを1枚まで選び、リムーブする。 (a1 + a2 effect) => atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{apMax:3000}} [sceneRemove short-form (player+max+side+filter) with apMax pick EXACT pattern of src/cards/ct-p03/B03120.ts a2 step2 (filter:{apMax:4000}), src/cards/ct-p09/B09100.ts a1 (apMax:8000), src/cards/ct-d11/D11003.ts a2 (apMax:6000); only the apMax value differs (3000). capability-map atom-handlers: sceneRemove short-form (uid absent + n/max) builds PA pick; filter.apMax numeric AP bound honored by matchOneFilter (target/candidates.ts). max:1 → nMin=0 (1枚まで = 0-pick legal, rules/15). side:'either' = どちらの現場でも (no 相手の restriction in text). cause:'effect' per all exemplars.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） (a2 trigger shell) => type:'triggered', scope:'on-evidence', trigger:{hook:'evidence:remove-by-action', optional:true} [Hirameki encoding EXACT twin of src/cards/ct-p03/B03120.ts a3, src/cards/ct-d11/D11003.ts a3, src/cards/ct-p09/B09092.ts a3. capability-map hooks/icons: hirameki = triggered + evidence:remove-by-action + optional:true → pendingHirameki side-channel (UI/AI fire/skip).]
//   - 【ヒラメキ】 effect requires a player pick (1枚まで選び リムーブ) resolves through hirameki path => bare short-form sceneRemove with apMax inside hirameki (no choice/target wrapper needed) [Hirameki SHORT-FORM pick proven shipped in src/cards/ct-d11/D11003.ts a3 (sceneSetState short-form {player:'self',max:1,side:'either',state:'active'} — no explicit target). On fire, src/ui/hooks/useEngineDispatch.ts:347 hiramekiResolve calls resolveEffectPicks(draft, ability.effect, ctx, {chooseAtomTarget, byPlayer}) — the SAME pick-resolution utility declared abilities use — so $pick short-form atoms are substituted (AI via chooseAtomTarget; human surfaces modal). Combining the sceneSetState-short-form-in-hirameki (D11003 a3) with the sceneRemove-apMax-short-form (D11003 a2) yields this exact form.]
//   - 【ヒラメキ】 condition (自分の現場に黒ずくめ) is honored on the hirameki path => ability.condition:sceneHas{...} on the evidence:remove-by-action ability [handleEvidenceRemovedHook (src/engine/listeners/triggered.ts:333-410) evaluates ability.condition via evalCond ('if (ability.condition && !evalCond(state, ability.condition, baseCtx)) continue;') BEFORE pushPendingHirameki. baseCtx.source.player = removed side = ヒラメキ holder, so sceneHas{side:'self'} = holder's own scene = '自分の現場'. Confirmed condition gates the hirameki fire.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'opp'
      },
      {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            trait: '黒ずくめの組織'
          }
        },
        nMin: 1
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        apMax: 3000
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】自分の現場に〚特徴［黒ずくめの組織］〛のキャラがいる場合、AP3000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
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
  condition: {
    kind: 'sceneHas',
    query: {
      area: 'scene',
      side: 'self',
      filter: {
        trait: '黒ずくめの組織'
      }
    },
    nMin: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        apMax: 3000
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分の現場に〚特徴［黒ずくめの組織］〛のキャラがいる場合、AP3000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ]
};

export const B09102: CardDef = {
  id: 'B09102',
  no: '1041/B09102',
  kind: 'character',
  names: [
    '毒島桐子'
  ],
  colors: [
    '黒'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    '泥参会'
  ],
  rarity: 'C',
  imageUrl: '1775608943945375.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ],
};
