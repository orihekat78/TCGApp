// cards/ct-p03/B03049 黒羽盗一 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【宣言】〚リムーブエリアに移す〛：自分のデッキのカードを下から1枚公開する。公開したカードが自分のFILEエリアの枚数以下のレベルの【白】のキャラの場合、登場させる。公開したカードがそれ以外の場合、手札に加える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'removeFromScene',
    target: {
      kind: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          fromBottom: true,
          maxN: 1,
          filter: {
            color: '白',
            kind: 'character',
            levelMax: {
              dyn: '$self.fileCount'
            }
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
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            viaEffect: true,
            // review B1: 公開したのは底カード — 同名コピーがデッキ上方にあっても底出現を抜く (lastIndexOf)
            deckPos: 'bottom',
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
        // matched 時は $revealed=[] (deckRevealUntil の exclusion gate) → 本枝不発 = 相互排他の else 判定
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$revealed',
          presence: 'matched'
        },
        then: {
          // review B1: 公開した底カード自身を取る positional verb (同名コピー安全 + deck0 即 refresh、
          // B03051 Q&A 同型 = 本カード QA「加えた時点でリフレッシュ」も充足)。BUG-180 参照。
          kind: 'atom',
          verb: 'handAddFromDeckBottom',
          args: {
            player: 'self'
          }
        }
      }
    ]
  },
  description: '【宣言】〚リムーブエリアに移す〛：自分のデッキのカードを下から1枚公開する。公開したカードが自分のFILEエリアの枚数以下のレベルの【白】のキャラの場合、登場させる。公開したカードがそれ以外の場合、手札に加える。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
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
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B03049: CardDef = {
  id: 'B03049',
  no: '0304/B03049',
  kind: 'character',
  names: [
    '黒羽盗一'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    'マジシャン'
  ],
  rarity: 'R',
  imageUrl: '1729133385782983.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
