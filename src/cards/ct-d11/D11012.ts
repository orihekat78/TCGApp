// cards/ct-d11/D11012 横溝重悟 (キャラ・宣言+ヒラメキ)
// rules: 10-action-event.md, 15-abilities-effects.md, 19-special-rules.md, 21-declared-ability-cost.md
// spec: .claude/specs/cards-analysis/D11012.md
//
// 公式テキスト:
//   【宣言】〚デッキの下に移す〛: LP0の〚特徴［警察］〛のキャラを1枚まで選び、
//     ターン終了時までLP＋1するか、ターン終了時までAP＋2000する。
//   【ヒラメキ】自分のリムーブエリアにある〚カード名［萩原千速］〛を1枚まで選び、手札に加える。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'selfToDeckBottom' },
  // LP0の[警察]を1枚まで選び、ターン終了時までLP＋1するか、ターン終了時までAP＋2000する。(LP+1 / AP+2000 の真の分岐)
  effect: {
    kind: 'choice', chooser: 'self',
    options: [
      // option 1: 対象キャラに LP+1 (turn)
      { kind: 'atom', verb: 'charModifyLP', args: { delta: 1, max: 1, side: 'self', filter: { trait: '警察', lpMax: 0 }, scope: 'turn' } },
      // option 2: 対象キャラに AP+2000 (turn)
      { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, max: 1, side: 'self', filter: { trait: '警察', lpMax: 0 }, scope: 'turn' } },
    ],
  },
  description: '【宣言】〚デッキ下〛: LP0の[警察]を1枚まで選び、ターン終了時までLP＋1かAP＋2000。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  // 2026-05-27 Option C: type:'icon-flash' → 'triggered' + trigger:{hook,optional:true} に統合
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 【ヒラメキ】自分のリムーブエリアにある[萩原千速]を1枚まで選び、手札に加える。
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '萩原千速' } } },
  description: '【ヒラメキ】リムーブの[萩原千速]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/19-special-rules.md'],
};

export const D11012: CardDef = {
  id: 'D11012',
  no: '0466/D11012',
  kind: 'character',
  names: ['横溝重悟'], colors: ['黄'],
  level: 4, ap: 4000, lp: 0,
  traits: ['警察', '神奈川県警'], keywords: [],
  rarity: 'D', imageUrl: '1775608977330557.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
