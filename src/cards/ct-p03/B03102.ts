// cards/ct-p03/B03102 横溝重悟 (キャラ) — engine-extension reasoning-hook batch #2 (2026-06-06 タスクC)
// rules: 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   自分の現場にいるレベル4以下の〚特徴［警察］〛のキャラが推理したとき、ターン終了時までこのキャラをAP＋1000する。
//
// a1: 推理反応 (reasoning:after-sleep、非 selfOnly = 自分の現場の別キャラ含む)。matcherCondition で
//     「推理したキャラが自分側 (side:'self') の [警察] Lv4以下」を gate。効果はこのキャラ自身を AP+1000 turn。
//     公式Q&Aどおり、推理キャラのスリープ直後、ミスリードと証拠獲得より前に発動する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'reasoning:after-sleep',
    // 推理したキャラ (payload) が自分側の [警察] Lv4以下のとき発火 (rules/11)
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { trait: '警察', levelMax: 4 } },
  },
  // ターン終了時までこのキャラをAP＋1000する
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
  description: '自分の現場のレベル4以下の[警察]が推理したとき、ターン終了時までこのキャラをAP＋1000する。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
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

export const B03102: CardDef = {
  id: 'B03102',
  no: '0355/B03102',
  kind: 'character',
  names: ['横溝重悟'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133463315361.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
