// cards/ct-p01/B01010P 毛利小五郎 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。\n
// 句マッピング:
//   - 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき (trigger) => trigger {hook 'leave:to-remove'} (NO selfOnly) + condition:{kind 'removedCharMatches', side:'opp', cause:'contact-ap', by:'self'} [removal-observer (反撃カード一族, cluster15) — certify-brief §反撃 variant 「このキャラとのコンタクトによってリムーブされたとき」=> {side:'opp',cause:'contact-ap',by:'self'}. Engine: src/engine/cond/eval.ts:329-356 removedCharMatches reads triggerPayload {side,cause,byUid}; by:'self' => byUid===ctx.source.uid (L344-346); side:'opp' => pl.side!==ctx.source.player (L335-337); cause check L339. Registered in CONDITION_KIND_MAP src/engine/cond/eval.ts:421. Payload emitted by src/engine/mutate/scene.ts:164-172 leave:to-remove = {uid,cause,side:player,byUid}. Attribution byUid=aUid(attacker=winner=this char) with cause 'contact-ap' set in src/engine/flow/contact.ts:264 judge(). Non-selfOnly on-scene ability fires via in-play scan src/engine/listeners/triggered.ts:189 collectCardsInPlay (毛利小五郎 survives contact, still on scene) -> scopeAllowsArea on-scene/scene -> selfOnly skipped -> ability.condition evalCond with triggerPayload.]
//   - 手札を1枚リムーブしてもよい。そうした場合、… => chain[ {verb 'discard', args:{player:'self', max:1}}, <そうした場合 step> ] [EXACT exemplar src/cards/ct-d03/D03002.ts a1: identical clause 「手札を1枚リムーブしてもよい。そうした場合、…自分は証拠を1つ得る。」 implemented as chain step1=discard{player:'self',max:1} then 「そうした場合」step. max:1 => n.min:0 (decline OK, rules/15 量指定子). discard atom short-form {player,max} grounded src/engine/effect/atom-handlers.ts:330-360 (buildShortFormPick defaultArea=hand). chain break gating: resolver.ts:59-84 — step sets __chainStepNoApply when no candidate/decline -> remaining steps skipped (src/engine/effect/resolve-picks.ts:544,588). discard removes hand card to remove area via mutate.hand.discardToRemove (atom-handlers.ts:345) = 「リムーブ」 (not deck).]
//   - 自分は証拠を1つ得る (chain tail = 「そうした場合」) => {verb 'evidenceGain', args:{player:'self', n:1}} [src/engine/effect/atom-handlers.ts:455-470 evidenceGain reads a.player, a.n; per-card deck0->refresh->add loop honors rules/14. Same verb in chain tail of D03002 a1. Runs only if step1 discarded >=1 (chain __chainStepNoApply gating) = 「そうした場合」semantics.]

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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          max: 1
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
  },
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B01010P: CardDef = {
  id: 'B01010P',
  no: '0006/B01010P',
  kind: 'character',
  names: [
    '毛利小五郎'
  ],
  colors: [
    '青'
  ],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [
    '探偵',
    '毛利探偵事務所'
  ],
  rarity: 'RP',
  imageUrl: '1734349765600233.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
