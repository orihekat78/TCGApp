// cards/ct-p03/B03014 塚本数美 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）\nターン終了時、このキャラを現場から手札に移し、手札を1枚リムーブする。
// 句マッピング:
//   - 〚突撃〛（登場したターンからすぐにアクションできる） => top-level CardDef keywords:['突撃'] (innate, unconditional) [Unconditional printed 突撃 → CardDef.keywords, NOT a separate ability. Exemplar: src/cards/ct-p07/B07021.ts (keywords:['突撃'], same 突撃 + ターン終了時 structure). TSV cards-data/ct-p03/character.tsv row B03014 shows 〚突撃〛 with no condition.]
//   - ターン終了時 (no turn specification → fires at end of EITHER player's turn) => trigger:{hook:'phase:end:start'} with NO turn condition [Official Q&A in .claude/specs/cards-data/ct-p03/character.tsv (B03014 q_a): 「相手のターン終了時に能力は発動しますか？」→「はい、ターンの指定がないので相手のターン終了時にも発動します」. src/engine/flow/turn.ts:60 emits phase:end:start with payload{player:p} every turn-end. src/engine/listeners/triggered.ts handleHook (lines 154-225) scans collectCardsInPlay (both sides, line 102) and builds ctx.source per reacting card — so a non-turn-player's char DOES react. Therefore omit turn condition (cf. B07021 a1 which DOES gate with condition:{turn:'self'} for its '自分の' specified text — B03014 intentionally has no such gate).]
//   - このキャラを現場から手札に移し => atom sceneToHand {uid:'$self'} [src/engine/effect/atom-handlers.ts:684-687: when a.uid is a bindref, resolveBindRef(a.uid) resolves '$self' → ctx.source.uid (atom-handlers.ts:146 `if(value==='$self') return ctx.source.uid`), then mutate.scene.toHand(s, uid). src/engine/mutate/scene.ts:167-186 bounces THAT char to its OWNER's hand (hand.push(char.cardId)). Exemplar verb usage: src/cards/ct-p06/B06069.ts (sceneToHand). $self uid usage on same hook: src/cards/ct-p07/B07021.ts a1 (sceneRemove uid:'$self' on phase:end:start, identical source-uid resolution path).]
//   - 手札を1枚リムーブする (forced, exactly 1, controller chooses which card) => atom discard {player:'self', n:1} [src/engine/effect/atom-handlers.ts:249-289: short-form (a.target===undefined && hasNorMax) → buildShortFormPick on owner hand area → player picks 1 → mutate.hand.discardToRemove. Forced (n:1) discard exemplars: src/cards/ct-d01/D01003.ts ({player:'self',n:1}), src/cards/ct-d04/D04010.ts ({player:'opp',n:1} for '相手は手札を1枚リムーブする'), src/cards/ct-d11/D11014.ts ({player:'self',n:1}). Player-pick surface → tier 2. After the preceding sceneToHand pushes this card's cardId into owner's hand, the discard pick runs on the post-bounce hand (capability-map: sequence pauses on pick, resumes on updated board).]
//   - (sequencing) 移し、…リムーブする — two forced sequential actions => Effect kind:'sequence' of [sceneToHand, discard] [capability-map.txt §WRAPPERS: 'sequence runs steps in order; if a step enqueues a pick, saves remaining + resumes post-pick on updated board.' Step1 (sceneToHand) is a direct mutation (no pick); Step2 (discard) enqueues the hand pick. Both forced (no optional/chain-skip needed). Official Q&A confirms forced: 「発動したら…解決しないことは選択できません」 and 「効果は可能なかぎり解決する」 (if char already left scene, sceneToHand no-ops via findChar guard, discard still runs) — sequence steps are independent (no no-candidate break), matching '可能なかぎり解決'.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneToHand',
        args: {
          uid: '$self'
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
  description: 'ターン終了時、このキャラを現場から手札に移し、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B03014: CardDef = {
  id: 'B03014',
  no: '0272/B03014',
  kind: 'character',
  names: [
    '塚本数美'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 4000,
  lp: 0,
  traits: [
    '高校生',
    '空手家'
  ],
  rarity: 'C',
  imageUrl: '1729133136434019.jpg',
  keywords: [
    '突撃'
  ],
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
