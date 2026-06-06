// cards/ct-p05/B05019 中道和志 (キャラ) — engine-extension optional-decision batch (2026-06-06 タスクC)
// rules: 11-reasoning.md, 15-abilities-effects.md (§「〜してもよい」), 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   自分の現場にいる〚カード名［毛利小五郎］〛が推理したとき、このキャラをリムーブしてもよい。
//     そうした場合、LP0のキャラを1枚まで選び、ターン終了時までLP＋1する。
//
// a1: 推理反応 (reasoning:end, 非 selfOnly)。matcherCondition triggerCharMatches{side:'self',
//   filter:{cardName:'毛利小五郎'}} で「自分側の[毛利小五郎]が推理したとき」を gate (B05011 同型)。
//   効果は optional (「〜してもよい」=任意): する を選ぶと
//     1) このキャラ ($self) をリムーブ (sceneRemove)、
//     2) LP0のキャラを1枚まで選び ターン終了時まで LP+1 (charModifyLP PA 短縮形, lpMin0/lpMax0, side either)。
//   optional 決定は engine の pendingEffectOptional 機構で human に「する/しない」を surface。
//   AI は既定で「しない」(self-cost を含むため conservative)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'reasoning:end',
    // 自分側の[毛利小五郎]が推理したとき (rules/11, 19 分割名対応)
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: '毛利小五郎' } },
  },
  effect: {
    // このキャラをリムーブしてもよい。そうした場合〜 (任意効果、rules/15)
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        // このキャラ自身をリムーブ (rules/15: 発動キャラが現場を離れても後続効果は継続)
        { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
        // LP0のキャラを1枚まで (どちらの現場でも, rules/15)、ターン終了時まで LP+1
        {
          kind: 'atom',
          verb: 'charModifyLP',
          args: { player: 'self', max: 1, side: 'either', delta: 1, scope: 'turn', filter: { lpMin: 0, lpMax: 0 } },
        },
      ],
    },
  },
  description:
    '自分の現場の[毛利小五郎]が推理したとき、このキャラをリムーブしてもよい。そうした場合、LP0のキャラを1枚まで選び、ターン終了時までLP+1する。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B05019: CardDef = {
  id: 'B05019',
  no: '0525/B05019',
  kind: 'character',
  names: ['中道和志'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['警察', '千葉県警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322178410995.jpg',
  abilities: [a1],
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
