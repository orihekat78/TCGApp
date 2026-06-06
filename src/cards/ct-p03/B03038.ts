// cards/ct-p03/B03038 時津潤哉 (キャラ) — engine-extension evidence 抑制 batch (2026-06-06 タスクC)
// rules: 11-reasoning.md (§LP≤0「証拠を1つも得ない」), 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】自分の現場にいるLP1以上のキャラが推理したとき、カードを1枚引いてもよい。
//     そうした場合、この推理によって自分は証拠を得ない。
//
// a1: 推理反応 (reasoning:end, 非 selfOnly)。【自分ターン中】= condition turn:self、【ターン1】= limit turn1。
//   matcherCondition triggerCharMatches{side:'self', filter:{lpMin:1}} で「自分側の LP1以上のキャラが推理したとき」を gate。
//   効果は optional (「引いてもよい」= 任意): する を選ぶと
//     1) draw 1、2) evidenceToDeck($trigger.gained) = この推理で得た証拠 (payload.gained 枚) をデッキ上へ戻す
//        (rules/11 §LP≤0 と同じ「証拠を1つも得ない」状態 = net 証拠0・デッキ復元)。
//   $trigger.gained は reasoning:end payload.gained を resolveBindRef が解決 (engine 拡張、optional 越しに triggerPayload を引継ぎ)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  trigger: {
    hook: 'reasoning:end',
    // 自分側の LP1以上のキャラが推理したとき
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { lpMin: 1 } },
  },
  effect: {
    // カードを1枚引いてもよい。そうした場合、この推理によって証拠を得ない (任意効果、rules/15)
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        // この推理で得た証拠 (gained 枚) をデッキ上へ戻す = 証拠を得ない
        { kind: 'atom', verb: 'evidenceToDeck', args: { player: 'self', n: '$trigger.gained' } },
      ],
    },
  },
  description:
    '【自分ターン中】【ターン1】自分の現場のLP1以上のキャラが推理したとき、1枚引いてもよい。そうした場合、この推理で証拠を得ない。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B03038: CardDef = {
  id: 'B03038',
  no: '0295/B03038',
  kind: 'character',
  names: ['時津潤哉'],
  colors: ['緑'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133249336775.jpg',
  abilities: [a1],
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
