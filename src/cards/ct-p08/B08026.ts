// cards/ct-p08/B08026 大滝悟郎 (character) — CARD PHASE step12 (useEventFromHand declared 初 consumer、engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md,
//        rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から5枚見る。その中からレベル6以下の【緑】のイベントを1枚まで
//   公開して手札に加え、残りをシャッフルしてデッキの下に移す。
//   【宣言】〚リムーブエリアに移す〛：手札からレベル6以下のイベントを1枚まで使用する。
//   この能力は自分の現場に〚カード名［服部平次］〛がいる場合に宣言できる。
//
// 句マッピング:
//   - 「上から5枚見る…1枚まで公開して手札に加え」=> deckRevealUntil{maxN:5, chooseMatch:'upTo'}
//     (rules/26「1枚まで」型 = 加えない選択可、B08026 QA 明示。BUG-132 GAP-1 経路) +
//     conditional{bound $matched} → handAddFromDeck。デッキ5枚未満 = 残り全部 (rules/26)。
//   - 「残りをシャッフルしてデッキの下に移す」=> deckToBottomBound{order:'shuffle'}。
//     公開した残りだけを無作為化し、未公開のデッキ本体はシャッフルしない。
//   - コスト「リムーブエリアに移す」= 対象省略 → 自身 (rules/21) => removeFromScene{target:self, n:1}。
//   - 「手札からレベル6以下のイベントを1枚まで使用する」=> useEventFromHand{max:1,
//     filter:{levelMax:6, kind:'event'}} (engine mega-wave W6 step3 — FILE/色制限バイパス、
//     公式Q&A「手札の使用と同様に解決してリムーブ」)。
//   - 「〚カード名［服部平次］〛がいる場合に宣言できる」=> condition bond{服部平次}
//     (宣言可否 gate、rules/17【絆】同義の明文条件)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          maxN: 5,
          chooseMatch: 'upTo',
          filter: { color: '緑', levelMax: 6, kind: 'event' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'shuffle' } },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から5枚見る。その中からレベル6以下の【緑】のイベントを1枚まで公開して手札に加え、残りをシャッフルしてデッキの下に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'bond', cardName: '服部平次' },
  cost: { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 },
  effect: {
    kind: 'atom',
    verb: 'useEventFromHand',
    args: { player: 'self', max: 1, filter: { levelMax: 6, kind: 'event' } },
  },
  description:
    '【宣言】〚リムーブエリアに移す〛：手札からレベル6以下のイベントを1枚まで使用する。この能力は自分の現場に〚カード名［服部平次］〛がいる場合に宣言できる。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B08026: CardDef = {
  id: 'B08026',
  no: '0866/B08026',
  kind: 'character',
  names: ['大滝悟郎'],
  colors: ['緑'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '大阪府警'],
  rarity: 'C',
  imageUrl: '1770731204469342.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
