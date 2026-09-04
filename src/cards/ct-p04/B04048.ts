// cards/ct-p04/B04048 羽田秀𠮷 (character) — M2後半 batch (engine primitive: drawUpToHandSize bind /
// handToDeckBottom n:{dyn}+shuffleMoved は同 branch の m2latter-dyn-bind probe で出荷済)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md,
//        rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー赤】【登場時】自分の手札が7枚になるまでカードを引く。手札から、引いた枚数と同じ数の
//   カードをシャッフルしてデッキの下に移す。
//   【宣言】【ターン1】カード名を1つ指定し、自分のデッキのカードを上から2枚見る。その中から指定した
//   カード名のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//
// 句マッピング:
//   - a1「【パートナー赤】【登場時】」=> triggered enter selfOnly + condition partnerColor 赤
//     (rules/17 条件未達 = 能力を持たない扱い → queue しない、triggered.ts BUG-033 gate)。
//   - a1「手札が7枚になるまでカードを引く」=> drawUpToHandSize{n:7, bind:'$drawn'}
//     (引いた cardId 群を bind。手札7枚以上 = draw 0 → bind 無し = 公式Q&A「実質何も起こらない」)。
//   - a1「引いた枚数と同じ数のカードをシャッフルしてデッキの下に移す」=>
//     handToDeckBottom{n:{dyn:'$bound.$drawn.count'}, shuffleMoved:true} (handler-local dyn 解決 +
//     移動群のみ順序無作為化。デッキ全体 shuffle (B05092) とは別物 — grounding 罠節)。
//     公式Q&A「自分が選択します。ただし必ず引いた枚数と同じ数」= 短縮形 pick n:min=max。
//   - ⚠ a1 は **chain** (grounding spec の sequence から意図的に変更): sequence は queue 時
//     resolveEffectPicks の初期 walk が top-level n:{dyn:'$bound...'} を resolveDynArgs で
//     literal 化する (bind 未確定 → count=0 に bake、walk-literalize 既知罠)。chain は
//     pre-walk passthrough (resolve-picks.ts:727) で dyn が runtime handler まで生存する。
//     drawUpToHandSize は chainStepNoApply を立てない (gate verb でない) ため
//     本カードでは chain ≡ sequence (逐次実行のみ、break 無し)。
//   - a2「カード名を1つ指定し」=> declareName{bind:'named'} (B09108 a2 同型・DeclareCardNameModal
//     配線済。Q&A: 存在カード名から自由指定 — UI 既存 UX に従う。AI 未供給 = 空文字 → 不一致)。
//   - a2「デッキのカードを上から2枚見る。その中から指定したカード名のカードを1枚まで公開して手札に
//     加え」=> deckRevealUntil{maxN:2, chooseMatch:'upTo', filter:{cardName:{dyn:'$declared.named'}}}
//     (D01013 a1 同型 + filter dyn は W5 r47 dispatch 時 resolveFilterDynObj。「1枚まで」= 0枚可
//     rules/15、公式Q&A「加えないことも可能」。分割名 rule/19 は cardName filter の components 照合に委譲。
//     「見る」= 非公開閲覧、公開は加える1枚のみ — 既存 overlay の見せ方を流用)。
//   - a2「残りを好きな順番でデッキの下に移す」=> conditional(bound $matched)→handAddFromDeck +
//     deckToBottomBound{bindKey:'$revealed'} (D01013 a1 と同構造の sequence。chain にしない —
//     match 0 件でも残りは必ずデッキ下へ移す必要があり、break 系ではない)。
//     デッキ残1枚 Q&A (見ている間はデッキ扱い / 加えた時点で refresh) = rules/26 engine 既存挙動。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '赤' },
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'drawUpToHandSize', args: { player: 'self', n: 7, bind: '$drawn' } },
      {
        kind: 'atom',
        verb: 'handToDeckBottom',
        args: { player: 'self', n: { dyn: '$bound.$drawn.count' }, shuffleMoved: true },
      },
    ],
  },
  description:
    '【パートナー赤】【登場時】自分の手札が7枚になるまでカードを引く。手札から、引いた枚数と同じ数のカードをシャッフルしてデッキの下に移す。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'declareName', args: { bind: 'named', domain: 'registered-card-name' } },
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          maxN: 2,
          chooseMatch: 'upTo',
          filter: { cardName: { dyn: '$declared.named' } },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: { player: 'self', cardId: '$matched.cardId', presentation: 'public-selected-card' },
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【宣言】【ターン1】カード名を1つ指定し、自分のデッキのカードを上から2枚見る。その中から指定したカード名のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B04048: CardDef = {
  id: 'B04048',
  no: '0440/B04048',
  kind: 'character',
  names: ['羽田秀𠮷'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['棋士', '赤井家'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1735287781726573.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
