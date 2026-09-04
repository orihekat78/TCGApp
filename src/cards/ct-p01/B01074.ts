// cards/ct-p01/B01074 羽田秀吉 (キャラ) — engine-extension reasoning-hook batch (2026-06-06 タスクC)
// rules: 11-reasoning.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   このキャラが推理したとき、相手は手札を公開する。（その後、元に戻す）
//
// a1: 推理反応 (reasoning:after-sleep selfOnly = このキャラが推理したとき)。
//     スリープ直後、ミスリードと証拠獲得の前に相手手札を公開する。情報開示は
//     状態変化なし → log atom (D05004 同型 no-op)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラが推理したとき: スリープ直後、ミスリードと証拠獲得の前。
  trigger: { hook: 'reasoning:after-sleep', selfOnly: true },
  // 相手は手札を公開する（その後、元に戻す）= presentation 窓のみ、状態不変 (D05004 a1 同型)
  effect: { kind: 'atom', verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'presentation' } },
  description: 'このキャラが推理したとき、相手は手札を公開する。（その後、元に戻す）',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】カードを1枚引く (BUG-140 補修 2026-06-13: TSV hirameki 列の取りこぼし修正) — D03011 a2 同型
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01074: CardDef = {
  id: 'B01074',
  no: '0064/B01074',
  kind: 'character',
  names: ['羽田秀吉'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['棋士', '赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013053532063.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
