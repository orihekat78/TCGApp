// cards/ct-d06/D06012 怪盗キッド (キャラ) — engine-extension disguise-hook batch (2026-06-06 タスクC)
// rules: 09-cutin-disguise.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【変装】【事件白】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
//
// a1: 変装 (icon-disguise)。ゲート条件【事件白】&【FILE5】を condition に格納 (canDisguise が評価)。
//     変装時の追加効果なし (pure disguise) — 変装メカニクスのゲーティングのみを検証する batch #1 最小カード。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-disguise',
  // 【事件白】かつ【FILE5】のときのみ変装可能 (rules/09 §変装, rules/17 §条件アイコン Point)
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: '白' },
      { kind: 'fileAtLeast', n: 5 },
    ],
  },
  description: '【変装】【事件白】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】キャラを1枚まで選びスリープ (BUG-140 補修 2026-06-13) — D05007 a2 同型
// (明示 $pick+target: hirameki fire は hiramekiResolve が chooseAtomTarget で auto-resolve するため短縮形不可)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const D06012: CardDef = {
  id: 'D06012',
  no: '0170/D06012',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 5,
  ap: 6000,
  lp: 0,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1718844176830680.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};
