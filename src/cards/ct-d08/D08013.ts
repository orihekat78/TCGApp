// cards/ct-d08/D08013 吉田歩美 (キャラ)
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D08013.md
//
// 公式テキスト:
//   【登場時】証拠を1つ得る。自分の証拠を1つ選び、手札に加える。自分は手札を1枚リムーブする。
//   【ヒラメキ】カードを1枚引く。
//
// a1: enter trigger → 証拠+1 → 選択証拠を手札へ → 手札1枚リム
//     物理動作 atom を順に並べるだけ。pick query は engine が verb 既定で推論。
// a2: 【ヒラメキ】証拠が action[case] でリムーブされた時に発動、1 ドロー
//     (factory call は使わず inline で全 ability の中身が見えるように展開)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'evidenceGain',   args: { player: 'self', n: 1 } }, // 証拠を1つ得る
      { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', n: 1 } }, // 自分の証拠を1つ選び、手札に加える
      { kind: 'atom', verb: 'discard',        args: { player: 'self', n: 1 } }, // 自分は手札を1枚選びリムーブする
    ],
  },
  description:'【登場時】証拠を1つ得る。自分の証拠を1つ選び、手札に加える。自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】証拠が action[case] でリムーブされた時 (evidence:remove-by-action) に発動。
//     プレイヤーは fire/skip を選択可。fire の場合 1 ドロー。
//     能力/効果によるリムーブでは発動しない (rules/10 §ヒラメキ)。
//     type:'icon-flash' は専用 listener (src/engine/listeners/hirameki.ts) が
//     evidence:remove-by-action emit 時に本 ability を検出する。`trigger` フィールドは
//     icon-flash では engine 未使用のため省略 (発動条件はコメントで明記)。
const a2: AbilityDef = {
  id: 'a2',
  type: 'icon-flash',        // ヒラメキ専用 listener が拾う ability 型 (rules/10)
  scope: 'on-evidence',      // 証拠エリアにいる間に有効 (rules/10)
  effect: {kind: 'atom',verb: 'draw',args: { player: 'self', n: 1 },}, // カードを1枚引く
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const D08013: CardDef = {
  id: 'D08013',
  no: '0494/D08013',
  kind: 'character',
  names: ['吉田歩美'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093483205.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
