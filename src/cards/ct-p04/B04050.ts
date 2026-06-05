// cards/ct-p04/B04050 ジェイムズ・ブラック (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【パートナー赤】【解決編】【登場時】レベル4以下のキャラを1枚まで選び、リムーブする。
//
// a1: triggered (enter) — 【パートナー赤】かつ【解決編】で gate / レベル4以下のキャラを1枚まで選びリムーブ
//     (sceneRemove levelMax:4, side:either)
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー赤】かつ【解決編】
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'caseStatus', status: '解決編' }] },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // レベル4以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 4 } } },
  description: '【パートナー赤】【解決編】【登場時】レベル4以下を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04050: CardDef = {
  id: 'B04050',
  no: '0442/B04050',
  kind: 'character',
  names: ['ジェイムズ・ブラック'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['FBI'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1735287781740195.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
