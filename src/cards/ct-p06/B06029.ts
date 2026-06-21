// cards/ct-p06/B06029 ヘビ男 (キャラ) — handToEvidence micro-cluster (2026-06-21)
// rules: 01-victory-conditions.md (§証拠), 06-card-types.md (§イベント/証拠化), 10-action-event.md (§ヒラメキ),
//        15-abilities-effects.md (§「〜してもよい。そうした場合」), 17-icons.md (§【登場時】)
//
// 公式テキスト:
//   【登場時】自分の証拠を1つ選び、手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// 公式Q&A (ct-p06 TSV): Q「自分の証拠を選ぶ際、どの順番のカードでも選べるか」A「はい、どの順番の証拠でも選べる。
//   そのうえで手札から裏向きで得る証拠は1番上に置かれる」→ evidenceToHand は全証拠から pick / handToEvidence は
//   evidence.gainCard で push (末尾=1番上)。
//
// a1: 【登場時】(enter selfOnly)。「〜してもよい。そうした場合〜」= chain (拡張5、exemplar D08003 a1)。
//     step1 = evidenceToHand max:1 (証拠1つ選び手札へ、してもよい=0可)。step1 が no-op (証拠0 or 0枚選択)
//     なら chain break で step2 skip = 「そうした場合」semantics。step2 = handToEvidence n:1 (手札1枚を裏向き証拠)。
// a2: 【ヒラメキ】evidence:remove-by-action optional。キャラを1枚まで選びスリープ (sceneSetState PA 短縮形 sleep、
//     exemplar D03013 / pick carrier は短縮形必須 BUG-130)。side either (text 制限なし、rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 自分の証拠を1つ選び、手札に加えてもよい (してもよい=max:1)
      { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', max: 1 } },
      // そうした場合、手札からカードを1枚裏向きで証拠として得る (する=n:1)
      { kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【登場時】自分の証拠を1つ選び手札に加えてもよい。そうした場合、手札から1枚を裏向きで証拠として得る。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】証拠が action[事件] でリムーブされたとき (任意発動)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // キャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', state: 'sleep', max: 1, side: 'either' } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B06029: CardDef = {
  id: 'B06029',
  no: '0652/B06029',
  kind: 'character',
  names: ['ヘビ男'],
  colors: ['緑'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285189427206.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/06-card-types.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
