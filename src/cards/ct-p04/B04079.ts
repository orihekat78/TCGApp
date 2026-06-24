// cards/ct-p04/B04079 宮本由美 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【登場時】自分のデッキのカードを上から1枚見る。それをデッキの1番下に移してもよい。（移さなかった場合、元に戻す）
// 句マッピング:
//   - 〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する） => __shared misreadX({x:1, abilityId:'a1'})  (type 'icon-misread') [src/cards/ct-d01/D01010.ts a1 = misreadX({x:1, abilityId:'a1'}) VERBATIM for the byte-identical 〚ミスリード1〛 text. src/cards/_shared/misreadX.ts:15 exports the factory (icon-misread, scope on-scene, noop misread-marker x). src/cards/_shared/index.ts:11 re-exports it. capability-map line 511 (misreadX) / 445 (icon-misread is a real AbilityType, handled by listeners/misread.ts on reasoning:before-add: defender scene scan, sleep + LP-X). scripts/taskA-codegen.cjs:108 lists 'misreadX' in SHARED_FNS whitelist.]
//   - 【登場時】 (trigger) => trigger {hook 'enter', selfOnly:true}, type 'triggered', scope 'on-scene' [src/cards/ct-p04/B04012.ts a1 and src/cards/ct-p05/B05020.ts (a1 uses leave:to-remove but same B05020 pack) use {hook 'enter',selfOnly:true} scope on-scene for 【登場時】 deck-look. src/cards/ct-d01/B... and D01013.ts a1 identical. 'enter' is a registered card-triggerable hook (capability-map §Hooks, emitted by mutate/scene; brief §Hooks lists enter(【登場時】)).]
//   - 自分のデッキのカードを上から1枚見る。 => atom deckRevealUntil {player:'self', maxN:1, bind:'$revealed', bindMatch:'$matched'} (no filter) [src/engine/effect/atom-handlers/picks.ts:9-194 atomDeckRevealUntil. With maxN=1 it reveals min(deck,1) top card (line 84-86). No filter => targetFilterToPredicate(undefined) returns ()=>true (src/cards/.../_shared.ts:73), so the single revealed top card is the first match => $matched=[{kind 'card',cardId:top,area:'deck',player}] (line ~178), $revealed=restIds= revealed minus matched = [] (lines 154-174). CRITICAL: the handler ONLY reads deck[i] and binds; it does NOT splice/remove the card from the deck (no mutate.deck/splice anywhere in atomDeckRevealUntil — verified, splice is only in the downstream deckToBottomBound/boundToRemove/handAddFromDeck). __pendingDeckRevealSide UI channel shows the looked-at card. maxN:1 deck-look shape copied from src/cards/ct-p05/B05020.ts a1 (maxN:1) and ct-p04/B04012.ts a1 (maxN:1). chooseMatch:'upTo' intentionally OMITTED — this card does NOT add to hand, so no take/decline pick is wanted.]
//   - それをデッキの1番下に移してもよい。 => optional { effect: atom deckToBottomBound {player:'self', bindKey:'$matched'} } [「してもよい」 = optional wrapper (brief DSL 規約). optional type = {kind 'optional'; effect:Effect} (src/engine/types/effect.ts:253). src/engine/effect/resolve-picks.ts:522-552 optional case: human chooser => pushPendingEffectOptionalSide (yes/no modal) + pause; on resume optionalRun:true runs inner, false skips; AI/non-human => skip by default (legal decline). VERBATIM optional-wrapper idiom from src/cards/ct-p07/B07057.ts a1 ({kind 'optional', effect:{...}}). 'それを' = the single revealed card = $matched. deckToBottomBound (picks.ts:195-234) reads ctx.bindings[bindKey] ($matched = [{cardId}]), splices that id from deck and mutate.deck.toBottom. bindKey '$matched' has cardId so it works (vs the usual '$revealed' which is empty here). deckToBottomBound shape from B05020.ts/B04012.ts a1 final step (bindKey there is '$revealed'; here '$matched' because no-filter routes the card to $matched).]
//   - （移さなかった場合、元に戻す） => optional declined => deckToBottomBound never runs => card stays at deck top (its original position) [atomDeckRevealUntil does NOT remove the revealed card from the deck array (verified picks.ts:9-194: only reads deck[i] + binds; the only deck splices in this file are in atomDeckToBottomBound:214 and atomBoundToRemove:255). So when the optional is declined (human picks 'no', or AI default-skip per resolve-picks.ts:551), no splice occurs and the card remains at the top in place = '元に戻す'. No extra effect node needed — this is the inherent no-op default of declining the optional.]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({
  x: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
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
          maxN: 1,
          bind: '$revealed',
          bindMatch: '$matched'
        }
      },
      {
        kind: 'optional',
        effect: {
          kind: 'atom',
          verb: 'deckToBottomBound',
          args: {
            player: 'self',
            bindKey: '$matched'
          }
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から1枚見る。それをデッキの1番下に移してもよい。（移さなかった場合、元に戻す）',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B04079: CardDef = {
  id: 'B04079',
  no: '0464/B04079',
  kind: 'character',
  names: [
    '宮本由美'
  ],
  colors: [
    '黄'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1735287822653513.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
