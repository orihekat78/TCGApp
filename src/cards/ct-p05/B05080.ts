// cards/ct-p05/B05080 羽田秀吉 (キャラ) — engine-extension triggerChar→target batch (2026-06-06 タスクC)
// rules: 11-reasoning.md, 13-keywords.md (§ミスリード), 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【ターン1】相手の現場にいるキャラが推理したとき、手札を1枚リムーブしてもよい。
//     そうした場合、ターン終了時までそのキャラをLP－1する。
//
// a1: 〚ミスリード1〛 — misreadX(1) 共通クラス (reasoning:before-add 経由、既存)。
// a2: 推理反応 (reasoning:end, 非 selfOnly)。matcherCondition triggerCharMatches{side:'opp'} で
//   「相手の現場のキャラが推理したとき」を gate + 【ターン1】= limit turn:1。
//   効果は chain (「〜してもよい。そうした場合〜」, D11007 同型):
//     step1) discard{max:1} = 手札を1枚リムーブ (skip 可 → chain break で「しない」を表現)
//     step2) charModifyLP{uid:'$trigger.uid'} = 「そのキャラ (=推理した相手キャラ)」を ターン終了時まで LP-1。
//   $trigger.uid は reasoning:end payload の推理キャラ uid を resolveBindRef が解決する (engine 拡張)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  trigger: {
    hook: 'reasoning:end',
    // 相手の現場にいるキャラが推理したとき (side:'opp' = payload.player !== source.player)
    matcherCondition: { kind: 'triggerCharMatches', side: 'opp' },
  },
  effect: {
    // 手札を1枚リムーブしてもよい。そうした場合〜 (chain: step1 が実効果ありのとき step2 を実行)
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブ (max:1 = skip 可。skip なら chain break = LP-1 しない)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そのキャラ (=推理した相手キャラ) を ターン終了時まで LP-1
      { kind: 'atom', verb: 'charModifyLP', args: { uid: '$trigger.uid', delta: -1, scope: 'turn' } },
    ],
  },
  description:
    '【ターン1】相手の現場のキャラが推理したとき、手札を1枚リムーブしてもよい。そうした場合、ターン終了時までそのキャラをLP-1する。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B05080: CardDef = {
  id: 'B05080',
  no: '0580/B05080',
  kind: 'character',
  names: ['羽田秀吉'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['棋士', '赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322226168482.jpg',
  abilities: [misreadX({ x: 1, abilityId: 'a1' }), a2],
  ruleRefs: ['rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
