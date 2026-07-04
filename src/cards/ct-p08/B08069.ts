// cards/ct-p08/B08069 風見裕也 (character) — CARD PHASE step12 (reserveEffect turn-end 初 consumer、engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md,
//        rules/25-qa-effects-resolution.md
//
// 公式テキスト:
//   【宣言】〚デッキの下に移す〛：ターン終了時、手札からレベル4以下の〚特徴［警察］〛のキャラを
//   1枚まで登場させる。
//
// 句マッピング:
//   - コスト「デッキの下に移す」= 対象省略 → 能力を使うキャラ自身 (rules/21) => cost selfToDeckBottom
//     (B08070 実戦検証済)。
//   - 「ターン終了時、…登場させる」=> reserveEffect{hook:'phase:end:start', mode:'turn-end'}
//     (engine mega-wave W6 step8 r75 — armedTurn guard、single-fire。engine probe RESERVE_TURNEND と
//     同 args 形状)。公式Q&A「2回以上使用したらそれぞれ発動」= entry 独立 queue (probe §8-7 pin) で整合。
//     公式Q&A「他のターン終了時能力と好きな順番で解決」= rules/25 未解決効果 queue の既存機序。
//   - 「手札からレベル4以下の〚特徴［警察］〛のキャラを1枚まで登場」=> sceneEnter 短縮形
//     {from:'hand', max:1, filter:{levelMax:4, trait:'警察', kind:'character'}} (D01008 同型)。
//     「1枚まで」= 0枚可。公式Q&A「効果によって登場したキャラの【登場時】は発動する」= sceneEnter
//     viaEffect 経路の既存挙動。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'selfToDeckBottom' },
  effect: {
    kind: 'atom',
    verb: 'reserveEffect',
    args: {
      hook: 'phase:end:start',
      mode: 'turn-end',
      effect: {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'hand',
          max: 1,
          viaEffect: true,
          filter: { levelMax: 4, trait: '警察', kind: 'character' },
        },
      },
    },
  },
  description:
    '【宣言】〚デッキの下に移す〛：ターン終了時、手札からレベル4以下の〚特徴［警察］〛のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B08069: CardDef = {
  id: 'B08069',
  no: '0906/B08069',
  kind: 'character',
  names: ['風見裕也'],
  colors: ['黄'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['警察', '警視庁', '公安'],
  rarity: 'C',
  imageUrl: '1770731255742474.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
