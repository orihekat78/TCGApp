// cards/ct-p05/B05097 鮫崎島治 (character) — Wave A 刈り取り (mill-choice idiom, engine変更0, 2026-07-11)
// rules: 03-field-areas.md (スリープ), 10-action-event.md (ヒラメキ), 14-refresh.md / 26-qa-deck-refresh.md
//        (リフレッシュ・可能な限りリムーブ), 15-abilities-effects.md, 17-icons.md (【宣言】/【ターン1】),
//        21-declared-ability-cost.md, 24-qa-naming-stun.md (スタン)
//
// 公式テキスト:
//   相手はリフレッシュによって証拠を得られない。
//   【宣言】【ターン1】自分のデッキのカードを上から5枚までリムーブする。（枚数を決めてからリムーブする）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// 句マッピング:
//   - a1 相手はリフレッシュによって証拠を得られない
//        => continuous{ scope:'on-scene', continuousModifier:{ opponentRestrict:['refreshEvidence'] } }
//        [engine mega-wave W2 (2026-07-03) 新 token 'refreshEvidence' (card-def.ts:150 が本カードを明記)。
//         mutate/deck.ts:141 refresh 時 readChar.restrictsOpponent(s, p='リフレッシュ実行側', 'refreshEvidence')
//         で相手 evidence +1 penalty を抑止。公式Q&A: リフレッシュ自体は成立・reshuffle/痕跡/refreshCount 不変、
//         証拠獲得のみ消える = narrow-gate で自然成立。src/cards/ct-p05/B05041.ts a2 が opponentRestrict continuous
//         の shape exemplar (scope on-set-host、本カードは現場常在なので scope on-scene)。]
//   - a2 【宣言】【ターン1】自分のデッキを上から5枚までリムーブする（枚数を決めてからリムーブする）
//        => declared + limit{turn,1} + effect choice{chooser:'self', options:[ mill n:0 .. mill n:5 ]}
//        [count-picker 不在のため A3 推奨 idiom = choice で「枚数を先に決める」を忠実表現。「5枚まで」=0〜5
//         (rules/15 まで=0可) → 6 択。mill は gate 無し = 可能な限りリムーブ + deck0 で refresh (core.ts atomMill)。
//         公式Q&A「デッキ残り枚数より多い数にできますか→はい、可能な限りリムーブ後リフレッシュ、残りは
//         リムーブしない」= gate 無し mill の既定挙動に一致 (rules/26)。ChoicePicker ラベルは
//         useActionsPanelFlow/cost.ts choiceOptionLabel の mill case で「デッキ上 N 枚をリムーブ」表示。]
//   - a3 【ヒラメキ】キャラを1枚まで選び、スリープさせる
//        => triggered{evidence:remove-by-action, optional} + sceneSetState{$pick,sleep,pick scene either 0-1}
//        [src/cards/ct-p06/B06049.ts a3 / src/cards/ct-d09/D09010.ts a2 と VERBATIM 同型。「1枚まで」= n.min0。
//         side:'either' = 無指定「キャラ」(rules/15 どちらの現場でも)。]

import type { AbilityDef, CardDef, Effect } from '@/engine/types';

// a1: 相手はリフレッシュによって証拠を得られない (continuous aura、W2 token)
const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: { opponentRestrict: ['refreshEvidence'] },
  description: '相手はリフレッシュによって証拠を得られない。',
  ruleRefs: ['rules/14-refresh.md', 'rules/26-qa-deck-refresh.md'],
};

// a2: 【宣言】【ターン1】自分のデッキを上から5枚までリムーブ (枚数を先に決める = choice 6択)
const millOptions: Effect[] = [0, 1, 2, 3, 4, 5].map((n) => ({
  kind: 'atom',
  verb: 'mill',
  args: { player: 'self', n },
}));
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 上から5枚までリムーブする（枚数を決めてからリムーブする）
  effect: { kind: 'choice', chooser: 'self', options: millOptions },
  description: '【宣言】【ターン1】自分のデッキのカードを上から5枚までリムーブする。（枚数を決めてからリムーブする）',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

// a3: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (B06049 a3 同型)
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B05097: CardDef = {
  id: 'B05097',
  no: '0595/B05097',
  kind: 'character',
  names: ['鮫崎島治'],
  colors: ['黄'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322226211262.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
