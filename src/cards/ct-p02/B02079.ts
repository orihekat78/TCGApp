// cards/ct-p02/B02079 千葉和伸 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/10-action-event.md, rules/13-keywords.md, rules/14-refresh.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【自分ターン中】【ターン1】自分の現場にいる〚特徴［警察］〛のキャラがコンタクトしたとき、カードを1枚引き、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【自分ターン中】 => a1.condition = {kind 'turn', player:'self'} [B01028.ts a3 / PR006.ts a1 use condition {kind 'turn',player:'self'} for 【自分ターン中】; eval.ts case 'turn' checks current-turn-player === resolved player.]
//   - 【ターン1】 => a1.limit = {kind 'turn', n:1} [B01028.ts a3 / B04004.ts use limit {kind 'turn',n:1}; triggered.ts:223-237 enforces turn limit via declaredUseCount per uid+abilityId (fire-time count). Q&A confirms simultaneous multi-copy resolution within limit.]
//   - 自分の現場にいる〚特徴［警察］〛のキャラがコンタクトしたとき (= a 警察 char on MY scene participates in a contact, as attacker OR defender/guard) => a1.trigger.hook='contact:start' + matcherCondition or[ triggerCharMatches{payloadKey:'aUid',side:'self',filter:{trait:'警察'}}, triggerCharMatches{payloadKey:'bUid',side:'self',filter:{trait:'警察'}} ] [state-machine.ts:392 emits contact:start with payload {aUid,bUid} (attacker=aUid, defender/guard=bUid) and source={player:byPlayer,uid:byUid}. Payload has NO 'uid'/'player' field, so default triggerCharMatches fails -> MUST use payloadKey (eval.ts:319-325 derives side by scene-scan). filter {trait:'警察'} honored via matchOneFilter (eval.ts:343, candidates.ts:276-279). Exemplar D04007.ts a2 (trigger.matcherCondition with triggerCharMatches+payloadKey, non-selfOnly third-party reaction on my-side scene char) and B04004.ts a1 (matcherCondition combining TWO triggerCharMatches with different payloadKey inside and/or). payloadKey field declared at effect.ts:79. or-over-(aUid,bUid) required because official Q&A in character.tsv (ct-p02 row B02079) states '(警察 char's own contact participation) でも発動しますか? -> はい' and 'コンタクトが発生した時点で発動 (【カットイン】より前)' = contact:start, with no attacker-only restriction; rules/08 'コンタクト中のキャラ' includes attacker AND target/guard. case-target actions skip contact:start (state-machine.ts:374-377) so aUid/bUid are always real scene chars.]
//   - カードを1枚引き => a1.effect.steps[0] = atom draw {player:'self', n:1} [atom-handlers draw {player,n} (capability-map); exemplar D01013.ts:70 / D03009.ts:45 verb 'draw' args {player:'self',n:1}. Sequence ordering: draw FIRST so a card exists to discard.]
//   - 手札を1枚リムーブする (mandatory, not してもよい) => a1.effect.steps[1] = atom discard {player:'self', n:1} [discard {player,target?,n?/max?,filter?} short-form enqueues a hand pick (capability-map). Mandatory n:1 shape is widely used: D01003.ts:30, D04007.ts:52, D08015.ts:26 all {kind 'atom',verb 'discard',args:{player:'self',n:1}}. Empty hand -> 0-candidate no-op (rules/15 '可能な限り').]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => a2 = {type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect: atom draw {player:'self',n:1}} [VERBATIM PR006.ts a2 (same 江戸川コナン ヒラメキ '【ヒラメキ】カードを1枚引く'). hooks.ts: evidence:remove-by-action + optional:true routes to pendingHirameki fire/skip side-channel (triggered.ts handleEvidenceRemovedHook). Capability-map confirms hirameki encoding = triggered + evidence:remove-by-action + optional:true.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'contact:start',
    matcherCondition: {
      kind: 'or',
      cs: [
        {
          kind: 'triggerCharMatches',
          payloadKey: 'aUid',
          side: 'self',
          filter: {
            trait: '警察'
          }
        },
        {
          kind: 'triggerCharMatches',
          payloadKey: 'bUid',
          side: 'self',
          filter: {
            trait: '警察'
          }
        }
      ]
    }
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      },
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          n: 1
        }
      }
    ]
  },
  description: '【自分ターン中】【ターン1】自分の現場にいる〚特徴［警察］〛のキャラがコンタクトしたとき、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: [
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

export const B02079: CardDef = {
  id: 'B02079',
  no: '0240/B02079',
  kind: 'character',
  names: [
    '千葉和伸'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1721357284536628.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
