// cards/ct-p04/B04054 赤井務武 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【解決編】〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: continuous — 【解決編】で gate し〚突撃［事件］〛を付与 (B09094 a2 同型 / grantKeywords)
// a2: 【ヒラメキ】証拠が action[事件] でリムーブされた時に発動、1ドロー (D08013 a2 同型)
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // 〚突撃［事件］〛
  continuousModifier: { grantKeywords: () => ['突撃[事件]'] },
  description: '【解決編】〚突撃［事件］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】(証拠からリムーブされるときに発動 / 任意発動)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B04054: CardDef = {
  id: 'B04054',
  no: '0446/B04054',
  kind: 'character',
  names: ['赤井務武'],
  colors: ['赤'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287781772453.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
