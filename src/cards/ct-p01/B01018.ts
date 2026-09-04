// cards/ct-p01/B01018 宮野志保 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/17-icons.md, rules/19-special-rules.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［江戸川コナン］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【相手ターン中】 => a1.condition = {kind 'turn', player:'opp'} [src/engine/cond/eval.ts:36 `case 'turn': return state.turn.player === resolvePlayer(cond.player, ctx)`. Exemplar src/cards/ct-d05/D05007.ts a1 uses identical {kind 'turn',player:'opp'} for word-for-word same 【相手ターン中】【現場リムーブ時】 text.]
//   - 【現場リムーブ時】(このキャラ自身) => a1.trigger = {hook 'leave:to-remove', selfOnly:true}, scope 'on-scene', type 'triggered' [leave:to-remove is a registered card-triggerable hook (src/engine/listeners/triggered.ts:69) handled at :381-388 via handleLeaveToRemoveSelf (builds virtual location for the card after it leaves scene) — the removed card's own 【現場リムーブ時】. validate.ts only forbids GRANTING this hook (:174), not printing it. Exemplar D05007.ts a1 = identical {hook 'leave:to-remove',selfOnly:true} printed ability.]
//   - 自分のデッキのカードを上から〚カード名［江戸川コナン］〛が出るまで1枚ずつ公開し => a1.step1 deckRevealUntil {player:'self', filter:{cardName:'江戸川コナン'}, bind:'$revealed', bindMatch:'$matched'} (NO maxN, NO chooseMatch) [src/engine/effect/atom-handlers.ts case 'deckRevealUntil' (:1336): with maxN UNSET it reveals deck top one-by-one (`for (const cardId of deck){ revealed.push; if(filter(cardId)){matched=cardId; break} }` :1410-1416) = exactly '出るまで1枚ずつ公開'. filter via targetFilterToPredicate (:65) — cardName HONORED at :101-105 via allCardNameComponentsForDef (src/engine/target/card-def-registry.ts:70, splits &/『』/() per rules/19, so a card named 江戸川コナン or 《江戸川コナン&工藤新一》 matches). cardName is a typed TargetFilter field (src/engine/types/effect.ts:97). With no chooseMatch+maxN the pick branch (:1418) is skipped → NO player surface (tier 1). Verb shape copied from src/cards/ct-p05/B05017.ts a1 (color/kind filter, same no-maxN reveal-until path).]
//   - それを手札に加える => a1.step2 conditional{if:{kind 'bound',key:'$matched',presence:'matched'}} then handAddFromDeck {player:'self', cardId:'$matched.cardId'} [src/engine/effect/atom-handlers.ts case 'handAddFromDeck' (:557): resolveBindRef('$matched.cardId') → splice out of self deck + mutate.hand.add (:567-574) (so matched card LEAVES deck → hand, no dup). 'bound matched' cond at cond/eval.ts:168-174 (true when bind array non-empty). The conditional is a found/not-found GUARD, not a player choice — mandatory add ('加える'); if 江戸川コナン absent the deck fully reveals, $matched=[] → step skips, nothing added (correct). Exact shape copied from src/cards/ct-p05/B05017.ts a1.]
//   - 残りの公開したカードをデッキの下に移し => a1.step3 deckToBottomBound {player:'self', bindKey:'$revealed'} [src/engine/effect/atom-handlers.ts case 'deckToBottomBound' (:1508): splices each $revealed cardId out of deck then mutate.deck.toBottom. $revealed already excludes the matched card (set at :1466-1487, no-maxN branch uses revealed.slice(0,-1)). Card text has NO '好きな順番で' (unlike D05007) → no reorder choice → tier 1 preserved. Exemplar B05017.ts a1 / D05007.ts a1 identical deckToBottomBound{bindKey:'$revealed'}.]
//   - デッキをシャッフルする => a1.step4 deckShuffle {player:'self'} [src/engine/effect/atom-handlers.ts case 'deckShuffle' (:1571): `mutate.deck.shuffle(s,p,ctx.rng)`. Exemplar src/cards/ct-p05/B05017.ts a1 final step is identical deckShuffle{player:'self'} appended after the same reveal/toBottom sequence (same '出るまで…デッキの下に移し、デッキをシャッフルする' family).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => a2 = {type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect: draw {player:'self', n:1}} [Exemplars src/cards/ct-d01/D01003.ts a2 AND D01006.ts a2 are byte-identical: same trigger/scope/effect with description '【ヒラメキ】カードを1枚引く。'. evidence:remove-by-action is the ヒラメキ hook (triggered.ts:376 handleEvidenceRemovedHook); optional:true routes fire/skip via pendingHirameki side-channel (任意発動, rules/10). draw verb honored (validate.ts ATOM_VERB_MAP; arg shape {player,n} from B01008/B01011/B01016). The parenthetical gloss is the standard ヒラメキ reminder text, no extra effect.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          filter: {
            cardName: '江戸川コナン'
          },
          bind: '$revealed',
          bindMatch: '$matched'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$matched',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: {
          player: 'self',
          bindKey: '$revealed',
          order: 'preserve'
        }
      },
      {
        kind: 'atom',
        verb: 'deckShuffle',
        args: {
          player: 'self'
        }
      }
    ]
  },
  description: '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［江戸川コナン］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
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

export const B01018: CardDef = {
  id: 'B01018',
  no: '0014/B01018',
  kind: 'character',
  names: [
    '宮野志保'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '科学者'
  ],
  rarity: 'C',
  imageUrl: '1714012985521956.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
