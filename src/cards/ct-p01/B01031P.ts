// cards/ct-p01/B01031P 伊織無我 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   相手の現場にいるキャラがコンタクトによってリムーブされたとき、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
// 句マッピング:
//   - 相手の現場にいるキャラが…リムーブされたとき (removal-observer trigger, opponent's char) => trigger {hook 'leave:to-remove'} (NO selfOnly) + condition:{kind 'removedCharMatches', side:'opp'} [src/engine/listeners/triggered.ts:381-389 dispatches leave:to-remove to in-play observers via handleHook (non-selfOnly path); handleHook L208-211 skips selfOnly only when set, so observer fires for any removed char. removedCharMatches in src/engine/cond/eval.ts:329-358: side:'opp' requires !sameSide where sameSide = pl.side===ctx.source.player → opponent's char only. Emit side = removed char owner from src/engine/mutate/scene.ts:166-170 {uid,cause,side:player,byUid}. Whitelisted in scripts/taskA-validate-specs.cjs:35 (hook), :60 (cond). Static-def leave:to-remove is valid (validate.ts:165-176 restriction applies only to GRANTED abilities).]
//   - コンタクトによって (by contact, attacker unspecified) => condition cause:'contact-ap', by omitted [src/engine/flow/contact.ts:262-264 calls mutate.scene.removeToRemove(state,bUid,'contact-ap',aUid) on AP-judge loss → emits cause:'contact-ap'. eval.ts:338-340: cond.cause!==undefined ⇒ pl.cause must equal 'contact-ap'. by omitted (eval.ts:341 cond.by===undefined skips attacker check) matches '攻撃者無指定' variant per certify-brief §反撃. effect.ts:71 type allows cause:'contact-ap'. Card text has NO 「このキャラとの」/「〚X〛のキャラとの」 attacker designation and NO stat/trait filter on removed char.]
//   - ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ => effect:{kind 'atom', verb 'charGrantKeyword', args:{uid:'$self', kw:'突撃', scope 'turn'}} [Exact verbatim exemplars: src/cards/ct-d04/D04005.ts:44 and src/cards/ct-d08/D08011.ts:22 (charGrantKeyword {uid:'$self', kw:'突撃', scope 'turn'}); plain 突撃 (NOT 突撃[キャラ]/[事件]) for the gloss '（登場したターンからすぐにアクションできる）' confirmed by ct-d09/D09025.ts and ct-d10/D10020.ts. atom-handlers.ts:1085-1106 charGrantKeyword: resolveBindRef('$self')→ctx.source.uid (atom-handlers.ts:167-169 $self → source uid = observer card B01031, since handleHook resolveCtx.source = card per triggered.ts:255-269), scope default→args.scope='turn', mutate.char.grantKeyword(s,grantUid,'突撃','turn'). scope 'turn' cleared at turn end. charGrantKeyword verb in capability-map.txt:49. 突撃 honored by action gate (read/keyword.ts honors granted keywords for 名乗り exception, rules/13). Effect is mandatory '持つ' (no optional). No removal verb in effect ⇒ no cascade-DEFER concern per certify-brief §反撃.]

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
    cause: 'contact-ap'
  },
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$self',
      kw: '突撃',
      scope: 'turn'
    }
  },
  description: '相手の現場にいるキャラがコンタクトによってリムーブされたとき、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B01031P: CardDef = {
  id: 'B01031P',
  no: '0025/B01031P',
  kind: 'character',
  names: [
    '伊織無我'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '執事'
  ],
  rarity: 'RP',
  imageUrl: '1714013000999069.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
