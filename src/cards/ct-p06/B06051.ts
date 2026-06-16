// cards/ct-p06/B06051 柳生十兵衛三厳 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）\n【事件YAIBA】【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。
// 句マッピング:
//   - 〚突撃〛（登場したターンからすぐにアクションできる） => CardDef.keywords:['突撃'] (innate printed keyword, NOT an ability) [src/cards/ct-p03/B03067.ts:55 keywords:['突撃']; src/cards/ct-p04/B04068.ts:62 同型. Engine naming-state action gate honors 突撃 at src/engine/flow/main/action.ts:8/43-46 (rules/13 名乗り例外). No ability needed.]
//   - 【事件YAIBA】 (条件アイコン) => ability.condition (and-wrapped) part: {kind 'caseTrait', trait:'YAIBA'} [src/cards/ct-p06/B06050.ts:41 {kind 'caseTrait', trait:'YAIBA'} (同 YAIBA caseTrait, ct-p06). cond/eval.ts caseTrait evaluates owner case特徴. 'YAIBA' is a registered caseTrait in this package.]
//   - 【ターン1】 => ability.limit = {kind 'turn', n:1} [src/cards/ct-d04/D04007.ts:42 limit:{kind 'turn', n:1}. Enforced in src/engine/listeners/triggered.ts handleHook: readChar.declaredUseCount >= limit.n → continue, and flag.incrDeclaredUseCount on fire (fire-time count = 辞退でも消費, rules/24 / D04007 Q&A note).]
//   - 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき => trigger {hook 'leave:to-remove'} (NO selfOnly) + condition part {kind 'removedCharMatches', side:'opp', cause:'contact-ap', by:'self'} [cluster15 removal-observer. src/engine/cond/eval.ts:329-357 removedCharMatches reads ctx.triggerPayload {side,cause,byUid}: side:'opp' = removed char NOT owner-side; cause must equal 'contact-ap'; by:'self' requires byUid===ctx.source.uid (observer = remover). src/engine/flow/contact.ts:264 removeToRemove(state, bUid, 'contact-ap', aUid) passes attacker uid (aUid) as byUid; winner aUid survives (rules/08) so it is still in scene. src/engine/mutate/scene.ts:170 emits leave:to-remove payload {uid,cause,side,byUid}. src/engine/listeners/triggered.ts registers leave:to-remove → handleHook in-play scan (collectCardsInPlay picks the surviving observer; non-selfOnly so it fires for OTHER removed char), then evalCond(ability.condition) with triggerPayload. Brief variant 「このキャラとのコンタクトによってリムーブされたとき」 = {side:'opp', cause:'contact-ap', by:'self'} (1:1). Effect removes only own hand (no 別カード removal) → no cascade DEFER concern.]
//   - 手札を1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。 => effect = optional{ chain[ discard{player:'self', n:1}, evidenceGain{player:'self', n:1} ] } [EXACT twin src/cards/ct-d04/D04007.ts:50-58 a2.effect (verbatim 公式テキスト 「手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る」). discard verb capability-map atom §discard (defaultArea=hand → removes own hand to remove area); evidenceGain §evidenceGain {player,n} face-down from deck (deck0→refresh guard wired, rules/14). optional = する/しない surface (rules/15 してもよい). chain = 'そうした場合' (前段 discard 不実行/手札0 で __chainStepNoApply → 後段 evidenceGain break, resolver.ts case 'chain').]
//   - condition 合成 (【事件YAIBA】 + removal-observer trigger payload condition) => {kind 'and', cs:[caseTrait, removedCharMatches]} on ability.condition [src/cards/ct-p03/B03067.ts:23 a2.condition {kind 'and', cs:[partnerColor, turn]} 同型. src/engine/cond/eval.ts:31-32 case 'and' → cs.every(c => evalCond(state, c, ctx)) passes SAME ctx (incl. triggerPayload) recursively, so both caseTrait and removedCharMatches see the leave:to-remove payload.]

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
    kind: 'and',
    cs: [
      {
        kind: 'caseTrait',
        trait: 'YAIBA'
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
  description: '【事件YAIBA】【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、自分は証拠を1つ得る。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B06051: CardDef = {
  id: 'B06051',
  no: '0672/B06051',
  kind: 'character',
  names: [
    '柳生十兵衛三厳'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    'YAIBA'
  ],
  rarity: 'R',
  imageUrl: '1754285220473694.jpg',
  keywords: [
    '突撃'
  ],
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
