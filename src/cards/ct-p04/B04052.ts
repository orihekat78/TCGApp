// cards/ct-p04/B04052 諸星大 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【パートナー赤】【登場時】レベル8以下のアクティブ状態のキャラを1枚まで選び、リムーブする。
//
// a1: triggered (enter) — 【パートナー赤】で gate / レベル8以下のアクティブ状態のキャラを1枚まで選びリムーブ
//     (sceneRemove levelMax:8, side:either, state:['active'])
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー赤】
  condition: { kind: 'partnerColor', color: '赤' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // レベル8以下のアクティブ状態のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 8 }, state: ['active'] } },
  description: '【パートナー赤】【登場時】レベル8以下のアクティブ状態を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/03-field-areas.md'],
};

export const B04052: CardDef = {
  id: 'B04052',
  no: '0444/B04052',
  kind: 'character',
  names: ['諸星大'],
  colors: ['赤'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [],
  keywords: [],
  rarity: 'R',
  imageUrl: '1735287781758879.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
