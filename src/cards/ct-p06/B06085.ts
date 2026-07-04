// cards/ct-p06/B06085 松田陣平 (character) — CARD PHASE step12 batch3 (evidenceGain faceUp 初 consumer, 2026-07-04)
// rules: 01-victory-conditions.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー黄】【宣言】【ターン1】【スリープ】：相手の証拠を1つまで選び、デッキの下に移す。
//   相手の現場にいるAP8000以下のキャラを1枚まで選び、相手はそのカードを表向きのまま証拠として得る。
//   相手の現場にいるMRのキャラを選んだ場合、相手はデッキのカードを上から1枚表向きで証拠として得る。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: sequence (chain でない — 公式Q&A「証拠を選ばなくても現場キャラを選べる / 逆も可」):
//   step1 = evidenceToDeckBottom: 相手証拠 0..1 pick → 持ち主(相手)のデッキ下 (B03084 a1 step1 同型)。
//   step2 = sceneToEvidence 短縮形: 相手現場 AP8000以下 0..1 pick → 所有者(相手)の証拠へ表向きで
//     (B03084 a1 step2 の levelMax→apMax 差替 + bind '$picked')。MR を選んだ場合は mutate.scene.toEvidence
//     の MR① redirect で相手 PA へ (公式Q&A: 証拠エリアに移動し、MR能力によってパートナーエリアに移動)。
//   step3 = conditional boundIsMr($picked) → evidenceGain{player:'opp', n:1, faceUp:true}
//     (「相手はデッキのカードを上から1枚表向きで証拠として得る」— evidenceGain faceUp arg 初 consumer)。
// a2: 【ヒラメキ】キャラを1枚まで選びスリープ (PR144 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黄' }, // 【パートナー黄】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  cost: { kind: 'sleepSelf' }, // 【スリープ】
  effect: {
    kind: 'sequence',
    steps: [
      // 相手の証拠を1つまで選び、デッキの下に移す (Q&A: どの位置でも選べる)
      {
        kind: 'atom',
        verb: 'evidenceToDeckBottom',
        args: {
          player: 'opp', // 証拠の持ち主 = 相手 (移動先も相手のデッキ下)
          target: { kind: 'pick', query: { area: 'evidence', side: 'opp' }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
      // 相手の現場にいるAP8000以下のキャラを1枚まで選び、相手はそのカードを表向きのまま証拠として得る
      { kind: 'atom', verb: 'sceneToEvidence', args: { player: 'opp', max: 1, filter: { apMax: 8000 }, faceUp: true, bind: '$picked' } },
      // 相手の現場にいるMRのキャラを選んだ場合、相手はデッキのカードを上から1枚表向きで証拠として得る
      {
        kind: 'conditional',
        if: { kind: 'boundIsMr', bindKey: '$picked' },
        then: { kind: 'atom', verb: 'evidenceGain', args: { player: 'opp', n: 1, faceUp: true } },
      },
    ],
  },
  description:
    '【パートナー黄】【宣言】【ターン1】【スリープ】：相手の証拠を1つまで選び、デッキの下に移す。相手の現場にいるAP8000以下のキャラを1枚まで選び、相手はそのカードを表向きのまま証拠として得る。相手の現場にいるMRのキャラを選んだ場合、相手はデッキのカードを上から1枚表向きで証拠として得る。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B06085: CardDef = {
  id: 'B06085',
  no: '0704/B06085',
  kind: 'character',
  names: ['松田陣平'],
  colors: ['黄'],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1754285244590256.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
  ],
};
