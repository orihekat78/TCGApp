// cards/ct-d07/D07018 ジン (character) — Task A green候補 (engine変更0)
// rules: rules/08-contact.md, rules/22-qa-action-contact.md, rules/17-icons.md, rules/19-special-rules.md, rules/10-action-event.md, rules/14-refresh.md
// 公式テキスト:
//   【自分ターン中】このキャラがレベル6以下のキャラとコンタクトしたとき、そのキャラをリムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【自分ターン中】 => a1.condition = {kind 'turn', player:'self'} [PR006.ts a1 / B02079.ts a1 use condition {kind 'turn',player:'self'} for 【自分ターン中】 on a contact:start trigger. cond/eval.ts case 'turn' (CONDITION_KIND_MAP turn:true) checks current-turn-player === resolved owner side. capability-map E lists 'turn' as supported.]
//   - このキャラが…コンタクトしたとき (発火条件; このキャラ=attacker) => a1.trigger = {hook 'contact:start', selfOnly:true} [EXACT twin PR237.ts/PR243.ts a1 ('このキャラがキャラとコンタクトしたとき' → {hook 'contact:start', selfOnly:true}); also PR006.ts a1, B01028.ts a2. state-machine.ts emits contact:start payload {aUid,bUid} with source={player:byPlayer, uid:byUid}=attacker; triggered.ts:231 selfOnlyMatches gates on source.uid===card.uid so fires only when this char is attacker. contact:start emitted only for char targets (case target skips). 【自分ターン中】 cond is consistent (attacks happen on own turn).]
//   - レベル6以下のキャラと => a1.trigger.matcherCondition = {kind 'triggerCharMatches', payloadKey:'bUid', filter:{levelMax:6}} [B02079.ts a1 establishes triggerCharMatches with payloadKey on contact:start payload ({aUid,bUid} has no 'player' field, so default uid path fails -> payloadKey required). effect.ts:90 declares triggerCharMatches {side?,filter?,excludeSource?,payloadKey?}. cond/eval.ts:314-345: with payloadKey:'bUid' it reads tcmUid=payload['bUid'] (the contacted opp char), scene-scans to derive its side, then runs matchOneFilter(state, cardId, filter, sceneChar, cand). candidates.ts:330-337 honors levelMax against effective level (def.level + lvlMod_permanent/turn/contact/action + continuous) — so a target whose effective level (rules/19 may have been reduced) is ≤6 passes. No side constraint added (text says only 'レベル6以下のキャラ', not opp-only — though in practice bUid is the opp participant). triggered.ts:236-248 builds matcherCondition ctx with triggerPayload:payload AND runs it AFTER selfOnly check (both AND, sequential continue), so attacker-gate + target-level-gate compose.]
//   - そのキャラをリムーブする => a1.effect = atom sceneRemove {uid:'$trigger.bUid', cause:'effect'} [EXACT twin PR237.ts/PR243.ts a1 effect. atom-handlers/_shared.ts:188-193 resolveBindRef('$trigger.bUid') -> ctx.triggerPayload['bUid'] (the contacted/other char = 'そのキャラ'). triggerPayload propagated to runtime ctx via apply-pick.ts:297-307 / resolve-picks.ts:544-545 / stack.ts entryToCtx. sceneRemove handler -> mutate.scene.removeToRemove(cause:'effect'); unresolved $-prefixed ref = silent no-op (safe). Forced removal (no 'してもよい') -> no optional wrapper.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => a2 = {type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect: atom draw {player:'self', n:1}} [VERBATIM identical to PR006.ts a2 and B02079.ts a2 (same 【ヒラメキ】カードを1枚引く). capability-map: ヒラメキ encoding = triggered + evidence:remove-by-action + optional:true -> pendingHirameki fire/skip side-channel (triggered.ts handleEvidenceRemovedHook). draw {player,n} atom verb honored.]
//   - stats / vanilla body: ジン / 黒 / level 4 / ap 4000 / lp 1 / trait 黒ずくめの組織 / no innate keyword => CardDef {kind 'character', colors:['黒'], level:4, ap:4000, lp:1, traits:['黒ずくめの組織'], keywords:[]} [From rec D07018.json (ap already scaled to 4000; level 4; lp 1). No printed innate keyword (迅速/突撃/疾風/ブレット) in text -> keywords:[]. Modeled on shipped character CardDef shape (PR237/B02079).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  trigger: {
    hook: 'contact:start',
    selfOnly: true,
    matcherCondition: {
      kind: 'triggerCharMatches',
      payloadKey: 'bUid',
      filter: {
        levelMax: 6
      }
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      uid: '$trigger.bUid',
      cause: 'effect'
    }
  },
  description: '【自分ターン中】このキャラがレベル6以下のキャラとコンタクトしたとき、そのキャラをリムーブする。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/22-qa-action-contact.md',
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

export const D07018: CardDef = {
  id: 'D07018',
  no: '0396/D07018',
  kind: 'character',
  names: [
    'ジン'
  ],
  colors: [
    '黒'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'D',
  imageUrl: '1729865282058831.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/22-qa-action-contact.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ],
};
