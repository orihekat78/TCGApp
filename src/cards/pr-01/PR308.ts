// rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene', condition: { kind: 'partnerColor', color: '赤' }, limit: { kind: 'turn', n: 1 },
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeDeckTop', player: 'self', n: 3 }] },
  effect: { kind: 'sequence', steps: [
    { kind: 'conditional', if: { kind: 'removeTraitAtLeast', player: 'self', trait: 'FBI', n: 2 }, then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { levelMax: 7 } } } },
    { kind: 'atom', verb: 'charModifyLevel', args: { player: 'self', side: 'opp', max: 1, delta: -1, scope: 'turn' } },
  ] },
  description: '【パートナー赤】【宣言】【ターン1】【スリープ】〚デッキのカードを上から3枚リムーブする〛：この能力のコストによって〚特徴［FBI］〛のキャラが2枚以上リムーブされた場合、レベル7以下のキャラを1枚まで選び、リムーブする。相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
export const PR308: CardDef = {
  id: 'PR308', no: '1161/PR308', kind: 'character', names: ['ジョディ・スターリング'], colors: ['赤'], level: 7, ap: 5000, lp: 1,
  traits: ['FBI'], keywords: [], rarity: 'PR', imageUrl: '1785395500821050.jpg', abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
