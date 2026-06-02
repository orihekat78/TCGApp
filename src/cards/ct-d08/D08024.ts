// cards/ct-d08/D08024 「あら…頼もしいじゃない…」 (イベント)
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 20-color-and-switch.md
// spec: .claude/specs/cards-analysis/D08024.md
//
// 公式テキスト:
//   自分のリムーブエリアにあるレベル5以下の〚カード名［阿笠博士］〛か
//   レベル5以下の〚特徴［少年探偵団］〛のキャラを1枚まで選び、登場させる。
//   〚特徴［少年探偵団］〛のキャラを1枚まで選び、ターン終了時までAP＋2000する。
//   【ヒラメキ】カードを1枚引く。
//
// a1: 個別実装 (sequence: choice→sceneEnter + choice→charModifyAP)
// a2: hiramekiDraw 共通クラス

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { hiramekiDraw } from '@/cards/_shared/hiramekiDraw';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      return (p as { kind?: unknown }).kind === 'event-use';
    },
  },
  effect: {
    kind: 'sequence',
    steps: [
      // リムーブから[阿笠博士]/[少年探偵団] Lv5以下を1枚まで選び、登場させる
      { kind: 'atom', verb: 'sceneEnter',   args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filterAny: [{ cardName: '阿笠博士', levelMax: 5 }, { trait: '少年探偵団', levelMax: 5 }] } },
      // [少年探偵団]を1枚まで選び、ターン終了時まで AP+2000
      { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, max: 1, side: 'either', filter: { trait: '少年探偵団' }, scope: 'turn' } },
    ],
  },
  description: 'リムーブから[阿衣博士]/[少年探偵団] Lv5以下を1枚まで登場し、[少年探偵団]を1枚まで AP+2000/ターン。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};

export const D08024: CardDef = {
  id: 'D08024',
  no: '0498/D08024',
  kind: 'event',
  names: ['「あら…頼もしいじゃない…」'],
  colors: ['青'],
  level: 6,
  traits: [],
  rarity: 'D',
  imageUrl: '1743743100630487.jpg',
  abilities: [a1, hiramekiDraw({ n: 1, abilityId: 'a2' })],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
  ],
};
