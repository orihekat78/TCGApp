// cards/ct-p06/B06033 「わが味方となるべし!!」 (イベント) — continuation-nest cluster (2026-06-22)
// rules: 01-victory-conditions.md (§証拠), 06-card-types.md (§イベント/証拠化), 10-action-event.md (§ヒラメキ),
//        14-refresh.md, 15-abilities-effects.md (§「〜してもよい。そうした場合」/ §各 step 独立),
//        17-icons.md, 20-color-and-switch.md (§効果による登場=色制限なし)
//
// 公式テキスト:
//   自分の証拠を1つ選び、手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。
//   手札からレベル6以下の【緑】の〚特徴［YAIBA］〛のキャラを1枚まで登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
//
// 公式Q&A (ct-p06 TSV):
//   Q「自分の証拠を選ぶ際、どの順番のカードでも選べるか」A「はい。手札から裏向きで得る証拠は1番上に置かれる」
//     → evidenceToHand は全証拠から pick / handToEvidence は evidence.gainCard で push (末尾=1番上)。B06029 と同型。
//   Q「証拠から手札に加えたカードを登場させることはできるか」A「はい。レベル6以下の【緑】特徴[YAIBA]なら可能」
//     → swap (evidenceToHand→handToEvidence) を **先に解決**してから sceneEnter の候補を手札から取る必要がある
//       (swap で手札に来た札も登場候補)。よって全体は sequence[ chain[swap], sceneEnter ] (各文は独立 step)。
//
// engine: この sequence[chain[evidenceToHand{pick}, handToEvidence], sceneEnter] 構造は、chain 内 pick が
//   pause したとき従来 1:1 continuation を親 sequence が上書きし handToEvidence を脱落させていた
//   (BUG-111 family continuation-nest)。本セッション (2026-06-22) で continuation を outer 連結 (nest) する
//   engine 修正を入れ解禁した。head=内側(chain) → outer=外側(sequence) の順に実行。
//
// 句マッピング (全 atom に出荷済 exemplar):
//   - 自分の証拠を1つ選び、手札に加えてもよい => evidenceToHand{player:'self', max:1} (してもよい=0可、rules/15)。
//   - そうした場合、手札からカードを1枚裏向きで証拠として得る => handToEvidence{player:'self', n:1} (する=必須)。
//     「そうした場合」= chain (step1 が no-op/0枚選択なら chain break で step2 skip)。B06029 a1 VERBATIM。
//   - 手札からレベル6以下の【緑】の特徴[YAIBA]のキャラを1枚まで登場 => sceneEnter{player:'self', from:'hand',
//     max:1, viaEffect:true, filter:{color:'緑', kind:'character', levelMax:6, trait:'YAIBA'}} (B05102 a1 同型 +
//     fixed levelMax + trait)。max:1=「1枚まで」0枚可。viaEffect:true=効果による登場 (事件の色制限なし、rules/20)。
//   - 【ヒラメキ】このカードを手札に加える => handAddFromRemove{player:'self', fromSelf:true} (B05102 a2 / PR085 VERBATIM)。
//     証拠から action[事件] でリムーブされるそのカード自身を手札へ (rules/10)。optional:true (発動/不発は所有者選択)。

import type { AbilityDef, CardDef } from '@/engine/types';

// イベント使用効果: sequence[ chain[evidence⇔hand swap], sceneEnter ]
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // イベント使用 (手札の使用 / ネクストヒント 両経路が同 payload を emit)。D05014 / B04064 a1 / B05102 a1 同型。
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の証拠を1つ選び、手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。
      {
        kind: 'chain',
        steps: [
          { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', max: 1 } },
          { kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } },
        ],
      },
      // 手札からレベル6以下の【緑】の特徴[YAIBA]のキャラを1枚まで登場させる (効果による登場 = 色制限なし)
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { color: '緑', kind: 'character', levelMax: 6, trait: 'YAIBA' } } },
    ],
  },
  description:
    '自分の証拠を1つ選び、手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。手札からレベル6以下の【緑】の〚特徴［YAIBA］〛のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

// 【ヒラメキ】このカードを手札に加える (証拠から action[事件] でリムーブされる自身を手札へ)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B06033: CardDef = {
  id: 'B06033',
  no: '0656/B06033',
  kind: 'event',
  names: ['「わが味方となるべし!!」'],
  colors: ['緑'],
  level: 6,
  // 特徴 (公式 category1 由来): YAIBA。event.tsv に features 列が無く抽出が drop していたため明示
  // (一次 API _raw/ct-p06-api.json category1=YAIBA が正本。先例 ef29f608 赤魔術 trait 補完と同根)。
  traits: ['YAIBA'],
  rarity: 'C',
  imageUrl: '1754285189451959.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/06-card-types.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
