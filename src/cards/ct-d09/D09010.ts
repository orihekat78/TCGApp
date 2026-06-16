// cards/ct-d09/D09010 降谷零 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/08-contact.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【ターン1】相手の現場にいるキャラが自分の現場にいる〚特徴［警察］〛のキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【ターン1】 => ability a1 limit:{kind 'turn',n:1} [src/cards/ct-d04/D04007.ts a2 uses limit:{kind 'turn',n:1} for an identical 【ターン1】 optional-discard→evidenceGain triggered ability. cap-map line 281: triggered limit kind 'turn' (n=1|2) is enforced (counted via declaredUseCount per uid+abilityId); fire-time count so a decline still consumes the turn use (rules/24 Q&A).]
//   - 相手の現場にいるキャラが…リムーブされたとき (removal-observer trigger) => ability a1 trigger {hook 'leave:to-remove'} (NO selfOnly) [cluster15 reverse-counter pattern in certify-brief §反撃 says trigger {hook 'leave:to-remove'} without selfOnly. src/engine/mutate/scene.ts:164-170 emits 'leave:to-remove' with payload {uid,cause,side,byUid} on every non-misplay removal. src/engine/listeners/triggered.ts:381-393 runs handleLeaveToRemoveSelf + handleHook (in-play scan); :211 skips selfOnly when undefined so an in-play observer fires. Twin self-leave usage of the hook  src/cards/ct-d01/D01012.ts a1 (selfOnly:true); we omit selfOnly per brief.]
//   - 自分の現場にいる〚特徴［警察］〛のキャラとのコンタクトによって => ability a1 condition:{kind 'removedCharMatches', side:'opp', cause:'contact-ap', by:{filter:{trait:'警察'}}} [src/engine/types/effect.ts:71 defines removedCharMatches{side?,cause?:'contact-ap'|..., by?:'self'|{filter,excludeSource?}}. src/engine/cond/eval.ts:329-356: side gate (pl.side===owner→'self', else 'opp'), cause exact-match, by:{filter} looks up byUid in state.players[source.player].scene and runs matchOneFilter(filter). src/engine/flow/contact.ts:264 calls removeToRemove(bUid,'contact-ap',aUid) so byUid=winner=attacker on observer's own side. Text has NO 'このキャラ以外' → excludeSource omitted (observer itself may be the 警察 attacker). trait filter is a standard TargetFilter field (cap-map TargetFilter §trait).]
//   - 手札を1枚リムーブしてもよい。そうした場合、 => effect optional{ chain[ discard{player:'self',n:1}, … ] } [src/cards/ct-d04/D04007.ts a2 is a VERBATIM twin: optional{chain[discard{player:'self',n:1}, evidenceGain{player:'self',n:1}]}. cap-map: optional = 「してもよい」 surface; chain = front-step success gate (discard with 0 hand → __chainStepNoApply → evidenceGain breaks), matching 「そうした場合」 (only if the hand card was actually removed). discard verb registered (cap-map ATOM_VERBS line 474).]
//   - 自分は証拠を1つ得る => chain step2 atom evidenceGain{player:'self', n:1} [src/cards/ct-d04/D04007.ts a2 step2 is identical. cap-map line 21: evidenceGain{player,n} = mutate.evidence.addFromDeck face-down; X15 wires deck0→refresh→remove0 loss guard (rules/14).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => ability a2 type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true} [src/cards/ct-d01/D01012.ts a2 is a VERBATIM twin (identical Japanese clause). cap-map line 332: Hirameki = triggered + trigger.hook 'evidence:remove-by-action' + optional:true (scope on-evidence); optional:true routes to pendingHirameki side-channel for UI fire/skip (cap-map line 326).]
//   - キャラを1枚まで選び、スリープさせる => ability a2 effect atom sceneSetState{uid:'$pick', state:'sleep', target:{pick, query:{area:'scene', side:'either'}, n:{min:0,max:1}, chooser:'self'}} [src/cards/ct-d01/D01012.ts a2 is VERBATIM (same args). 「1枚まで」=n.min:0 (0枚可, rules/15). side:'either' = unscoped 「キャラ」 (rules/15 どちらの現場でも). sceneSetState verb registered (cap-map ATOM_VERBS); also used in src/cards/ct-d09/D09014.ts a1 (state:'sleep', max:1, side:'either').]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'removedCharMatches',
    side: 'opp',
    cause: 'contact-ap',
    by: {
      filter: {
        trait: '警察'
      }
    }
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'evidenceGain',
          args: {
            player: 'self',
            n: 1
          }
        }
      ]
    }
  },
  description: '【ターン1】相手の現場にいるキャラが自分の現場にいる〚特徴［警察］〛のキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/10-action-event.md',
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
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const D09010: CardDef = {
  id: 'D09010',
  no: '0503/D09010',
  kind: 'character',
  names: [
    '降谷零'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '公安'
  ],
  rarity: 'D',
  imageUrl: '1743742875181118.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
