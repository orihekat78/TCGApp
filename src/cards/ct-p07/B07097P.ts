// cards/ct-p07/B07097P キール (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/10-action-event.md, rules/13-keywords.md, rules/17-icons.md
// 公式テキスト:
//   〚ブレット〛（このキャラのアクションはガードできない）\n相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//   【ヒラメキ】キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 〚ブレット〛（このキャラのアクションはガードできない） => CardDef.keywords: ['ブレット'] (innate unconditional printed keyword) [src/cards/ct-p03/B03014.ts mapping note: 'Unconditional printed keyword -> CardDef.keywords, NOT a separate ability' (B06101/B03067/B04068 all use keywords:['突撃']). Guard gate honors it: src/engine/flow/guard.ts:47 readChar.hasKeyword(state,byUid,'ブレット') -> candidates=[] (unguardable). hasKeyword aggregates def.keywords[]: src/engine/read/char.ts:176 base = def.keywords ?? [], returned at :203 (...base,...). Pure JSON, no closure needed. NOT on STILL-OPEN gate.]
//   - 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。 => triggered ability, scope 'on-scene', trigger.hook 'leave:to-remove' (no selfOnly), trigger.matcherCondition:{kind 'removedCharMatches', side:'opp', cause:'contact-ap', by:'self'}, effect: atom draw {player:'self',n:1} [§反撃 removal-observer family explicitly UNLOCKED in certify-brief cluster15. Condition impl src/engine/cond/eval.ts:329-357 removedCharMatches reads ctx.triggerPayload {uid,cause,side,byUid}; by:'self' compares byUid===ctx.source.uid (L344-346) = 'このキャラとの'. Type src/engine/types/effect.ts:71. Emit src/engine/mutate/scene.ts:163-172 leave:to-remove payload {uid,cause,side:player,byUid}. Contact judge src/engine/flow/contact.ts:264 removeToRemove(state,bUid,'contact-ap',aUid) where aUid=winner=remover, bUid=removed defender. In-play observer scan src/engine/listeners/triggered.ts:190 collectCardsInPlay + :207 hook match + :211 selfOnly (NOT set) + :216-228 matcherCondition evaluated with payload. Test tests/engine/cond/removed-char-matches.test.ts confirms by:self fires when byUid===observer uid (side:opp). draw atom shape from src/cards/ct-d08/D08013.ts a2 {verb 'draw',args:{player:'self',n:1}}. Effect has NO removal verb -> no cascade -> no limit needed (brief DEFER clause N/A). matcherCondition placement (not ability.condition) confirmed by sibling payload-conditions guardedBySelf/enterOrderEquals in src/cards/ct-d11/D11016.ts:21, D11009.ts:25.]
//   - 【ヒラメキ】キャラを1枚まで選び、スリープさせる。 => triggered ability, scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect: choice -> sceneSetState pick {area:'scene', side:'either', n:{min:0,max:1}, uid:'$pick'} [EXACT text/structure twin: src/cards/ct-d08/D08019.ts a2 — identical clause '【ヒラメキ】キャラを1枚まで選び、スリープさせる。' with choice->sceneSetState carrier {uid:'$pick', state:'sleep', target:{kind 'pick',query:{area:'scene',side:'either'},n:{min:0,max:1},chooser:'self'}} (comment notes explicit $pick+target carrier needed so hiramekiResolve auto-picks). Hirameki encoding = triggered + hook 'evidence:remove-by-action' + optional:true (capability-map L332; src/cards/ct-d04/D04004.ts a2, src/cards/ct-d08/D08013.ts a2). 'キャラを1枚まで選び' = n.min:0 (0枚可, rules/15). NOT on gate list.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    matcherCondition: {
      kind: 'removedCharMatches',
      side: 'opp',
      cause: 'contact-ap',
      by: 'self'
    }
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
    'rules/13-keywords.md',
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
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/17-icons.md'
  ]
};

export const B07097P: CardDef = {
  id: 'B07097P',
  no: '0824/B07097P',
  kind: 'character',
  names: [
    'キール'
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
  rarity: 'RP',
  imageUrl: '1763546840488878.jpg',
  keywords: [
    'ブレット'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/17-icons.md'
  ],
};
