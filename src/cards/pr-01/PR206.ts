// cards/pr-01/PR206 大滝悟郎 (character)
// rules: 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md,
//        16-card-set.md, 17-icons.md, 21-declared-ability-cost.md

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'sceneFaceDownSetCardCountAtLeast', player: 'self', n: 2 },
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '自分の現場にいるキャラに裏向きでセットされているカードが合わせて2枚以上ある場合、このキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  effect: { kind: 'atom', verb: 'charSetCard', args: { player: 'self', side: 'self', max: 1, filter: { trait: '警察' }, fromDeckTop: true, faceUp: false } },
  description: '【宣言】【ターン1】自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '大阪府警' } } },
  description: '【ヒラメキ】自分のリムーブエリアにある〚特徴［大阪府警］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

export const PR206: CardDef = {
  id: 'PR206', no: '0834/PR206', kind: 'character', names: ['大滝悟郎'], colors: ['緑'], level: 5, ap: 6000, lp: 0,
  traits: ['警察', '大阪府警'], rarity: 'PR', imageUrl: '1764290716070874.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/10-action-event.md', 'rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
