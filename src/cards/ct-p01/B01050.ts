// cards/ct-p01/B01050 怪盗1412号 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   このキャラはスリープ状態で登場する。\n【登場時】自分のデッキのカードを上から1枚公開する。公開したカードが【白】のカードの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - このキャラはスリープ状態で登場する。 => CardDef.entersSleep:true。mutate.scene.enter が enter hook より前に sleep で生成し、通常プレイ/ネクストヒント/効果登場の全経路で一時 active を公開しない。
//   - 【登場時】自分のデッキのカードを上から1枚公開する。 => a2 step1: atom deckRevealUntil {player:'self', filter:{color:'白'}, maxN:1, bind:'$revealed', bindMatch:'$matched'} [Modeled on B01013.ts a1 (src/cards/ct-p01/B01013.ts) which uses deckRevealUntil maxN/bind/bindMatch. Verified atom-handlers.ts lines 1037-1119: maxN=1 reveals top min(deck,1) card; matched=first filter hit (or null); $revealed = revealed minus first matched occurrence; $matched = [card] or [].]
//   - 公開したカードが【白】のカードの場合、手札に加える。 => a2 step2: conditional if:{bound key:'$matched' presence:'matched'} then: atom handAddFromDeck {player:'self', cardId:'$matched.cardId'} [color filter honored in deckRevealUntil predicate path: targetFilterToPredicate atom-handlers.ts:66-69 'wants.some(w=>d.colors.includes(w))' -> '白' membership (2色含白も白扱い, rules/20). bound{presence:'matched'} = non-empty array, cond/eval.ts:129-135. handAddFromDeck splices $matched.cardId from deck to hand, atom-handlers.ts:403-423. Plain conditional (NOT optional) = mandatory, matching official Q&A ct-p01/character.tsv row 53 '白の場合手札に加えずデッキ下にできますか -> いいえ必ず手札に加えます'.]
//   - 公開したカードがそれ以外の場合、デッキの下に移す。 => a2 step3: atom deckToBottomBound {player:'self', bindKey:'$revealed'} [Mutually-exclusive branch achieved via $revealed binding: when 白 matched, $matched=[card] and $revealed=[] (matched excluded by revealed.indexOf splice, atom-handlers.ts:1082-1095) so deckToBottomBound no-ops (bound.length===0 early return, atom-handlers.ts:1124); when NOT 白, $matched=[] (conditional skips), $revealed=[card] -> moved to deck bottom. deckToBottomBound splices from deck then mutate.deck.toBottom, atom-handlers.ts:1120-1139. Same composition as B01013.ts a1 sequence.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => a3: triggered scope:'on-evidence' trigger:{hook:'evidence:remove-by-action', optional:true} -> atom draw {player:'self', n:1} [Exact copy of D08013.ts a2 / B01011.ts a2 (src/cards/ct-d08/D08013.ts, src/cards/ct-p01/B01011.ts). Brief '【ヒラメキ】カードを1枚引く' canonical pattern. evidence:remove-by-action hook + optional:true routes to pendingHirameki side-channel per capability-map hooks section; draw verb honored atom-handlers.ts.]

import type { AbilityDef, CardDef } from '@/engine/types';

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
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          filter: {
            color: '白'
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
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から1枚公開する。公開したカードが【白】のカードの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
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

export const B01050: CardDef = {
  id: 'B01050',
  no: '0042/B01050',
  kind: 'character',
  names: [
    '怪盗1412号'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 4000,
  lp: 2,
  entersSleep: true,
  traits: [
    '怪盗'
  ],
  rarity: 'C',
  imageUrl: '1714013020329346.jpg',
  abilities: [a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
