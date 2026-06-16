// cards/ct-p07/B07084P 千葉和伸 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/10-action-event.md, rules/17-icons.md, rules/14-refresh.md, rules/03-field-areas.md
// 公式テキスト:
//   相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//   【ヒラメキ】キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 相手の現場にいるキャラが … リムーブされたとき (a1 trigger/side) => trigger.hook='leave:to-remove' (NOT selfOnly) + condition removedCharMatches {side:'opp'} [src/engine/mutate/scene.ts:160-171 emits 'leave:to-remove' with payload {uid,cause,side:player,byUid} on any non-misplay removal. src/engine/listeners/triggered.ts:381-393 routes leave:to-remove to handleHook (in-play scan, non-selfOnly) so the observer (not the leaving card) reacts; handleHook L218-244 sets ctx.source.uid=card.uid (observer's own uid), ctx.source.player=card.player, triggerPayload=payload. src/engine/cond/eval.ts:329-336: sameSide=(pl.side===ctx.source.player); cond.side='opp' requires !sameSide i.e. removed char belongs to opponent of observer. Matches D08013-style triggered-on-scene structure.]
//   - このキャラとのコンタクトによって (a1 cause+by) => condition removedCharMatches {cause:'contact-ap', by:'self'} [src/engine/flow/contact.ts:262-264 judge() calls mutate.scene.removeToRemove(state,bUid,'contact-ap',aUid) — bUid=loser/defender (removed char), 'contact-ap'=cause, aUid=attacker/winner passed as byUid. src/engine/cond/eval.ts:339-345: cond.cause must equal pl.cause ('contact-ap'); cond.by==='self' requires byUid===ctx.source.uid, i.e. the contact attacker IS the observer (千葉和伸). This is the brief's cluster15 §反撃 variant 「このキャラとのコンタクトによってリムーブされたとき」→ {side:'opp',cause:'contact-ap',by:'self'}. Type sig confirmed at src/engine/types/effect.ts:71. Cluster15 enabled per eval.ts:421 CONDITION map true. No removal verb in effect (only draw) and no cascade risk, so absence of limitPerTurn is allowed per brief.]
//   - カードを1枚引く (a1 effect) => atom verb 'draw' args {player:'self', n:1} [Exemplar src/cards/ct-d08/D08013.ts a2: {kind 'atom',verb 'draw',args:{player:'self',n:1}}. capability-map line 'draw — args {player,n:number}; mutate.deck.draw (pushes to hand)'. Tier-1 (no selection at resolution).]
//   - 【ヒラメキ】キャラを1枚まで選び、スリープさせる。 (a2) => triggered scope 'on-evidence' trigger{hook 'evidence:remove-by-action',optional:true} + choice/sceneSetState(uid:'$pick'+target pick n.min0..max1) [Verbatim-identical exemplar src/cards/ct-d08/D08019.ts a2 (same official text 「キャラを1枚まで選び、スリープさせる」). Engine: capability-map L332 Hirameki=triggered + trigger.hook 'evidence:remove-by-action' + optional:true; D08019 comment notes the choice-wrapped sceneSetState with explicit $pick+target query is required so hirameki fire auto-picks via chooseAtomTarget. n.min:0/max:1 = 「1枚まで」 (rules/15, 0枚可). side:'either' (no area restriction in text). Tier-2 (player pick/optional).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'removedCharMatches',
    side: 'opp',
    cause: 'contact-ap',
    by: 'self'
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/14-refresh.md',
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
    kind: 'choice',
    chooser: 'self',
    options: [
      {
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
      }
    ]
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const B07084P: CardDef = {
  id: 'B07084P',
  no: '0812/B07084P',
  kind: 'character',
  names: [
    '千葉和伸'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'CP',
  imageUrl: '1763546825843775.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/17-icons.md',
    'rules/14-refresh.md',
    'rules/03-field-areas.md'
  ],
};
