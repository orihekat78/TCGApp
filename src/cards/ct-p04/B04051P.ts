// cards/ct-p04/B04051P 宮野明美 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から〚カード名［赤井秀一］〛か〚カード名［諸星大］〛か〚カード名［ライ］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【登場時】 => a1 trigger {hook 'enter', selfOnly:true}, type 'triggered', scope 'on-scene' [src/cards/ct-p05/B05017.ts a1 is identical {type 'triggered',scope 'on-scene',trigger {hook 'enter',selfOnly:true}} for a 【登場時】 character that runs the same deckRevealUntil sequence. 'enter' is a registered card-triggerable hook (brief Hooks §enter / capability-map). selfOnly:true = source.uid (the entering char itself).]
//   - 自分のデッキのカードを上から〚カード名［赤井秀一］〛か〚カード名［諸星大］〛か〚カード名［ライ］〛が出るまで1枚ずつ公開し => a1 step1 deckRevealUntil {player:'self', filter:{cardName:['赤井秀一','諸星大','ライ']}, bind:'$revealed', bindMatch:'$matched'} (NO maxN, NO chooseMatch) [src/engine/effect/atom-handlers.ts case 'deckRevealUntil' (:1336): maxN-UNSET branch (~:1413) `for (const cardId of deck){ revealed.push; if(filter(cardId)){matched=cardId; break} }` = exactly '出るまで1枚ずつ公開, match で停止'. filter via targetFilterToPredicate (:65): cardName HONORED at :101-105 — `Array.isArray(filter.cardName)? filter.cardName : [filter.cardName]` (line 102 = ARRAY supported) then `wants.some(w => allCardNameComponentsForDef(d).includes(w))` = OR over the 3 names ('か'区切り = OR). This is the wave#2 cluster2 (2026-06-12) fix that overrides the STALE cap-map note (cap-map said cardName dropped in this path; live code now honors it — verified directly). allCardNameComponentsForDef (src/engine/target/card-def-registry.ts:70) returns each printed name + &/『』/() split components (rules/19). Since no chooseMatch+maxN, the pick branch (:1428 `if (a.chooseMatch === 'upTo' && maxN !== undefined)`) is SKIPPED → no player surface (tier 1). Verb shape copied from B01018.ts a1 (single cardName) + B05017.ts a1 (filter+no-maxN reveal-until path).]
//   - それを手札に加える => a1 step2 conditional{if:{kind 'bound',key:'$matched',presence:'matched'}, then: atom handAddFromDeck {player:'self', cardId:'$matched.cardId'}} [src/engine/effect/atom-handlers.ts case 'handAddFromDeck' (:557): resolveBindRef('$matched.cardId') → splice out of self deck + mutate.hand.add (matched card LEAVES deck → hand, no dup). 'bound matched' cond (src/engine/cond/eval.ts:168-174, true when bind array non-empty) is a found/NOT-found GUARD, not a player choice — mandatory add ('加える', no してもよい). If none of the 3 names present, deck fully reveals, $matched=[] → conditional skips (nothing added, correct per rules/15 可能な限り). Exact shape copied from B01018.ts a1 / B05017.ts a1.]
//   - 残りの公開したカードをデッキの下に移し => a1 step3 deckToBottomBound {player:'self', bindKey:'$revealed'} [src/engine/effect/atom-handlers.ts case 'deckToBottomBound' (:1508): splices each $revealed cardId out of deck then mutate.deck.toBottom. In no-maxN branch (~:1466) $revealed = revealed.slice(0,-1) → already EXCLUDES the matched card. No '好きな順番で' in card text → no reorder choice → tier 1 preserved. Exemplar B01018.ts a1 / B05017.ts a1 identical deckToBottomBound{bindKey:'$revealed'}.]
//   - デッキをシャッフルする => a1 step4 deckShuffle {player:'self'} [src/engine/effect/atom-handlers.ts case 'deckShuffle' (:1571): mutate.deck.shuffle(s,p,ctx.rng). Exemplar B05017.ts a1 / B01018.ts a1 final step is identical deckShuffle{player:'self'} appended after the same reveal/toBottom sequence (same '出るまで…デッキの下に移し、デッキをシャッフルする' family).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => a2 = {type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect: atom draw {player:'self', n:1}} [BYTE-IDENTICAL to src/cards/ct-p01/B01018.ts a2 (same 宮野 family, same 【ヒラメキ】カードを1枚引く wording incl. parenthetical gloss). evidence:remove-by-action is the ヒラメキ hook (brief Hooks list); optional:true routes 任意発動 via pendingHirameki side-channel (rules/10 — only fires on アクション[事件] removal, player chooses). draw verb honored (capability-map Atom verbs; arg {player,n}). The parenthetical (証拠からリムーブされるときに発動する) is the standard ヒラメキ reminder text, no extra effect. Also matches D01003.ts a2 / D01006.ts a2 exemplars.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          filter: {
            cardName: [
              '赤井秀一',
              '諸星大',
              'ライ'
            ]
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
          bindKey: '$revealed'
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
  description: '【登場時】自分のデッキのカードを上から〚カード名［赤井秀一］〛か〚カード名［諸星大］〛か〚カード名［ライ］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
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

export const B04051P: CardDef = {
  id: 'B04051P',
  no: '0443/B04051P',
  kind: 'character',
  names: [
    '宮野明美'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [],
  rarity: 'RP',
  imageUrl: '1735287781754923.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
