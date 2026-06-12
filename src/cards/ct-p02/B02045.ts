// cards/ct-p02/B02045 怪盗キッド (キャラ) — engine-extension disguise-hook batch (2026-06-06 タスクC)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【変装】【事件白】【FILE4】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
//   【変装時】キャラを1枚まで選び、ターン終了時までAP－2000する。
//
// a1: 変装 (icon-disguise)。ゲート条件【事件白】&【FILE4】を condition に格納 (canDisguise が評価)。
// a2: 【変装時】(disguise:into selfOnly)。キャラを1枚まで選び、ターン終了時まで AP－2000
//     (B03127 a1 / D01006 a1 と同型 charModifyAP 短縮形: side 既定 either, max:1=0〜1, scope:'turn')。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-disguise',
  // 【事件白】かつ【FILE4】のときのみ変装可能 (rules/09, rules/17 §条件アイコン Point)
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: '白' },
      { kind: 'fileAtLeast', n: 4 },
    ],
  },
  description: '【変装】【事件白】【FILE4】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'disguise:into', selfOnly: true },
  // キャラを1枚まで選び、ターン終了時までAP－2000する (短縮形: uid 不在 → pick 構築, side 既定 either, max:1)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: -2000, max: 1, side: 'either', scope: 'turn' } },
  description: '【変装時】キャラを1枚まで選び、ターン終了時までAP－2000する。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a3: 【ヒラメキ】キャラを1枚まで選びスリープ (BUG-140 補修 2026-06-13) — D05007 a2 同型
// (明示 $pick+target: hirameki fire は hiramekiResolve が chooseAtomTarget で auto-resolve するため短縮形不可)
const a3: AbilityDef = {
  id: 'a3',
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

export const B02045: CardDef = {
  id: 'B02045',
  no: '0211/B02045',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357230985593.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/23-qa-disguise-cutin.md'],
};
