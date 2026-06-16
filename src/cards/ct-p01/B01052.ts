// cards/ct-p01/B01052 工藤優作 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   このキャラはスリープ状態で登場する。\n【登場時】自分のデッキのカードを上から1枚公開する。公開したカードがレベル6以下のキャラの場合、登場させる。公開したカードがそれ以外の場合、手札に加える。
// 句マッピング:
//   - このキャラはスリープ状態で登場する。 => a1: triggered enter(selfOnly) -> atom sceneSetState {uid:'$self', state:'sleep'} [Exact copy of B01011.ts a1 and B01050.ts a1 (src/cards/ct-p01/B01011.ts, B01050.ts) — same official clause. 'enter' hook fires on ALL entry paths (handUseCard/next-hint/sceneEnter) per capability-map hooks section. TSV qAndA for B01052 (ct-p01/character.tsv) confirms '能力や効果によって登場する場合でもスリープ状態で登場 -> はい', so capturing every enter path via selfOnly 'enter' is correct. sceneSetState verb + uid:'$self' honored: atom-handlers.ts case 'sceneSetState' (line ~38 cap-map) and resolveBindRef '$self'->ctx.source.uid (atom-handlers.ts:166).]
//   - 【登場時】自分のデッキのカードを上から1枚公開する。 => a2 step1: atom deckRevealUntil {player:'self', filter:{kind 'character', levelMax:6}, maxN:1, bind:'$revealed', bindMatch:'$matched'} [Modeled on D01012.ts a1 / B01050.ts a2 / D11019.ts a1 (src/cards). atom-handlers.ts:1336-1505: maxN=1 reveals top min(deck,1) card; $matched=first filter hit (or []); $revealed=revealed minus first matched occurrence. NO chooseMatch (forced match) -> reveal is tier-1, no pick surfaced. Empty deck -> reveals 0, both binds empty, both conditionals skip (rules/26 reveal-what-available).]
//   - 公開したカードがレベル6以下のキャラの場合、登場させる。 => a2 step2: conditional if:{bound key:'$matched' presence:'matched'} then: atom sceneEnter {cardId:'$matched.cardId', viaEffect:true, target:{query:{area:'deck',side:'self'}}} [Filter 'kind character' + 'levelMax:6' both honored in deckRevealUntil predicate path: targetFilterToPredicate atom-handlers.ts:65-110 — 'filter.kind!==undefined && d.kind!==filter.kind' (BUG-118) and '(d.level??Infinity)>filter.levelMax' (level<=6). sceneEnter from deck with cardId:'$matched.cardId' + target.query.area='deck',side='self' is the proven reveal->enter pattern: D11019.ts a1 / D01012.ts a1 (engine comment atom-handlers.ts:741 'D11019 deckRevealUntil -> sceneEnter sequence'). sceneEnter splices matched cardId from deck (atom-handlers.ts:806-815 sourceArea==='deck' splice) preventing dup. Plain conditional (NOT optional/chooseMatch) = mandatory, per B01052 TSV qAndA '登場させず手札に加えることはできますか -> いいえ。必ず登場させます'. NO enterSleep: official text has no sleep qualifier on the entered char, so it enters active/named normally (rules/06 同ターン登場=名乗り).]
//   - 公開したカードがそれ以外の場合、手札に加える。 => a2 step3: conditional if:{bound key:'$revealed' presence:'matched'} then: atom handAddFromDeck {player:'self', cardId:'$revealed.cardId'} [Mutually-exclusive else achieved via $revealed binding: maxN:1 -> when matched, $matched=[card] and $revealed=[] (matched excluded by indexOf splice, atom-handlers.ts:1487-1495); when NOT matched, $matched=[], $revealed=[card]. bound{presence:'matched'} = non-empty array (cond/eval.ts:170-172). handAddFromDeck resolves cardId via resolveBindRef('$revealed.cardId') = binding[0].cardId (atom-handlers.ts:184-197, identical accessor to the proven '$matched.cardId') then splices that cardId from deck->hand (atom-handlers.ts:557-578). The revealed card is still in the deck (deckRevealUntil only binds, does not move) so handAddFromDeck's deck.indexOf finds it — same deck-splice mechanism B01050.ts a2 uses for its else (deckToBottomBound $revealed). Composition ($revealed.cardId into handAddFromDeck) is novel but each piece is grounded in live code.]

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
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$self',
      state: 'sleep'
    }
  },
  description: 'このキャラはスリープ状態で登場する。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

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
          filter: {
            kind: 'character',
            levelMax: 6
          },
          maxN: 1,
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
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            viaEffect: true,
            target: {
              query: {
                area: 'deck',
                side: 'self'
              }
            }
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$revealed',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$revealed.cardId'
          }
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から1枚公開する。公開したカードがレベル6以下のキャラの場合、登場させる。公開したカードがそれ以外の場合、手札に加える。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B01052: CardDef = {
  id: 'B01052',
  no: '0044/B01052',
  kind: 'character',
  names: [
    '工藤優作'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 5000,
  lp: 2,
  traits: [
    '小説家'
  ],
  rarity: 'C',
  imageUrl: '1714013041155817.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
