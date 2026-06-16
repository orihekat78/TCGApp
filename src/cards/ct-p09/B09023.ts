// cards/ct-p09/B09023 沖田総司 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/07-action-flow.md, rules/08-contact.md, rules/10-action-event.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   〚突撃〛（名乗り状態でもアクションできる）\n【事件青＆緑】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、相手のFILEエリアにあるカードを上から1枚表向きにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 〚突撃〛（名乗り状態でもアクションできる） => CardDef.keywords:['突撃'] (印字 innate keyword、ability 不要) [src/cards/ct-p06/B06101.ts: 〚突撃〛(plain, no [キャラ]/[事件] suffix) is declared as keywords:['突撃']. My gloss '（名乗り状態でもアクションできる）' is the standard plain 突撃 reminder gloss (same as B06101's '（登場したターンからすぐにアクションできる）'). rules/13-keywords.md: 突撃=名乗り状態でもアクションできる. keywords[] = printed innate only.]
//   - 【事件青＆緑】 => ability.condition (and-leg 1): {kind 'caseColor', color:['青','緑'], combine:'and'} [src/cards/ct-p09/B09021.ts a2 uses byte-identical condition {kind 'caseColor', color:['青','緑'], combine:'and'} for the same '【事件青＆緑】'. Engine src/engine/cond/eval.ts:45-56 case 'caseColor' with combine==='and' => want.every(c=>have.includes(c)) (事件が両色を持つ必要、rules/17 §「&」=全色). Registered eval.ts:408 caseColor:true.]
//   - 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき (removal-observer trigger) => ability.type 'triggered', scope 'on-scene', trigger {hook 'leave:to-remove'} (NO selfOnly) + condition and-leg 2 {kind 'removedCharMatches', side:'opp', cause:'contact-ap', by:'self'} [certify-brief §反撃: variant 「このキャラとのコンタクトによってリムーブされたとき」 => {side:'opp', cause:'contact-ap', by:'self'}, trigger hook leave:to-remove WITHOUT selfOnly. Engine: src/engine/cond/eval.ts:329-357 case 'removedCharMatches' reads ctx.triggerPayload {side,cause,byUid}; side:'opp' => sameSide=(pl.side===ctx.source.player) must be false (除去キャラが相手所属); cause guard pl.cause==='contact-ap'; by:'self' => byUid===ctx.source.uid (観察者=除去者). Registered eval.ts:421 removedCharMatches:true (cluster15 2026-06-16). Payload populated at src/engine/mutate/scene.ts:164-170 emit('leave:to-remove', {uid:leavingUid, cause, side:player(=除去キャラ所属), byUid}). byUid set by src/engine/flow/contact.ts:262-264 removeToRemove(state,bUid,'contact-ap',aUid) where aUid=winner=attacker. handleHook (src/engine/listeners/triggered.ts:183-244) iterates in-play observers, skips selfOnly (unset), then evalCond(ability.condition, ctx.source={observer cardId/uid/player}). No stat-filter on removed char (only side:'opp') => within cluster15 support. Effect (fileFlipTop) contains no removal verb => no cascade-DEFER concern.]
//   - 相手のFILEエリアにあるカードを上から1枚表向きにする => effect: {kind 'atom', verb 'fileFlipTop', args:{player:'opp'}} [src/cards/ct-p09/B09021.ts a2 step1 uses fileFlipTop{player:'opp'} for same clause '相手のFILEエリアにあるカードを上から1枚表向きにする'. Engine src/engine/effect/atom-handlers.ts:446-453 case 'fileFlipTop': resolvePlayer(a.player)->mutate.file.flipTop; comment line 447 EXPLICITLY names B09023 as a target (B09021/B09108/B09023/B09005). 既に表向き/FILE空は no-op (chain break しない). Registered validate.ts ATOM_VERB_MAP fileFlipTop (E3). No player selection => tier 1 for this ability.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => ability.type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true} [src/cards/ct-p03/B03079.ts a2 is BYTE-IDENTICAL (same official text). Canonical ヒラメキ encoding per capability-map hooks §evidence:remove-by-action / §Hirameki: triggered + on-evidence + optional:true => pendingHirameki side-channel (UI/AI fire-or-skip, 任意発動 rules/10). Also exemplar src/cards/ct-d08/D08013.ts a2, src/cards/ct-p01/B01018.ts a2.]
//   - キャラを1枚まで選び、スリープさせる => effect: {kind 'atom', verb 'sceneSetState', args:{uid:'$pick', state:'sleep', target:{kind 'pick', query:{area:'scene', side:'either'}, n:{min:0,max:1}, chooser:'self'}}} [src/cards/ct-p03/B03079.ts a2 is BYTE-IDENTICAL DSL for the SAME official clause. Engine src/engine/effect/atom-handlers.ts case 'sceneSetState' Pattern A short-form (uid:'$pick'+state+pick target). n.min:0 = 「1枚まで」(0-pick legal, rules/15); side:'either' = どちらの現場も対象 (エリア指定なしの「キャラ」, rules/15). Registered validate.ts ATOM_VERB_MAP sceneSetState. Pick surface => tier 2.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseColor',
        color: [
          '青',
          '緑'
        ],
        combine: 'and'
      },
      {
        kind: 'removedCharMatches',
        side: 'opp',
        cause: 'contact-ap',
        by: 'self'
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'fileFlipTop',
    args: {
      player: 'opp'
    }
  },
  description: '【事件青＆緑】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、相手のFILEエリアにあるカードを上から1枚表向きにする。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
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
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either'
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md'
  ]
};

export const B09023: CardDef = {
  id: 'B09023',
  no: '0967/B09023',
  kind: 'character',
  names: [
    '沖田総司'
  ],
  colors: [
    '緑'
  ],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: [
    '高校生'
  ],
  rarity: 'R',
  imageUrl: '1775608819089822.jpg',
  keywords: [
    '突撃'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
