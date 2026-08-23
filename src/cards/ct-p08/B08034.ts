// cards/ct-p08/B08034 工藤優作 (キャラ) — engine-extension set-card 除去 batch (2026-06-06 タスクC)
// rules: 11-reasoning.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   【事件白】【パートナー白】【登場時】AP8000以下のキャラを1枚まで選び、リムーブする。
//     自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。
//   【ターン1】自分の現場にいるキャラが推理したとき、自分の現場にいるキャラに裏向きでセットされている
//     カードを1枚リムーブしてもよい。そうした場合、カードを1枚引く。
//
// a1: 【事件白】【パートナー白】(condition) + 【登場時】(enter selfOnly) →
//   sequence([sceneRemove apMax:8000 max:1 (両現場), charSetCard fromDeckTop max:1 自陣])。いずれも既存 (B09100/B02023 同型)。
// a2: 【ターン1】推理反応 (reasoning:end + triggerCharMatches{self}) →
//   chain([charRemoveSetCard{hasSetCards} (1枚リムーブしてもよい), draw 1 (そうした場合)])。
//   charRemoveSetCard = 在場キャラから setCard を1枚外す新 verb (rules/16)。chain で「してもよい/そうした場合」を表現。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'caseColor', color: '白' }, { kind: 'partnerColor', color: '白' }] }, // 【事件白】【パートナー白】
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  effect: {
    kind: 'sequence',
    steps: [
      // AP8000以下のキャラを1枚まで選び、リムーブ (どちらの現場でも)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } },
      // 自分の現場のキャラを1枚まで選び、デッキ上1枚を裏向きでセット
      { kind: 'atom', verb: 'charSetCard', args: { player: 'self', max: 1, side: 'self', fromDeckTop: true, faceUp: false } },
    ],
  },
  description: '【事件白】【パートナー白】【登場時】AP8000以下を1枚まで選びリムーブ。自分の現場のキャラ1枚にデッキ上1枚を裏向きセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  trigger: {
    hook: 'reasoning:end',
    // 自分の現場にいるキャラが推理したとき (filter 無し = 自分側の任意キャラ)
    // BUG-179: filter:{} で scene 走査を強制 (無いと自パートナーの推理でも誤発火。印字は「現場にいるキャラ」)。
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: {} },
  },
  effect: {
    // セットされているカードを1枚リムーブしてもよい。そうした場合、1枚引く (chain)
    kind: 'chain',
    steps: [
      // 自分の現場のキャラ (setCard 保持) を1枚選び、その setCard を1枚リムーブ (skip 可 → chain break)
      { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', max: 1, side: 'self', filter: { hasFaceDownSetCards: true }, faceDownOnly: true } },
      // そうした場合、カードを1枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【ターン1】自分の現場のキャラが推理したとき、セットされているカードを1枚リムーブしてもよい。そうした場合、1枚引く。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B08034: CardDef = {
  id: 'B08034',
  no: '0873/B08034',
  kind: 'character',
  names: ['工藤優作'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['小説家'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731222552780.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
