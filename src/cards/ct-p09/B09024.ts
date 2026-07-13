import type { AbilityDef, CardDef } from '@/engine/types';

const grantedRemoveTrigger: AbilityDef = {
  id: 'remove-draw-discard', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  ] },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  continuousModifier: { triggeredAbilityAura: { filter: { trait: '大阪府警', kind: 'character' }, excludeSelf: true, ability: grantedRemoveTrigger } },
  description: '自分の現場にいるこのキャラ以外の〚特徴［大阪府警］〛のキャラに「【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。」を与える。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '緑' },
  cost: { kind: 'pay', items: [
    { kind: 'sleepSelf' },
    { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { trait: '警察', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  ] },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 7 }, bind: '$removed' } },
    { kind: 'conditional', if: { kind: 'boundCharStateIs', bindKey: '$removed', state: 'sleep' }, then: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } } },
  ] },
  description: '【パートナー緑】【宣言】【スリープ】〚手札から特徴［警察］のキャラを1枚公開する〛：相手の現場にいるレベル7以下のキャラを1枚まで選び、リムーブする。スリープ状態のキャラをリムーブした場合、自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09024: CardDef = {
  id: 'B09024', no: '0968/B09024', kind: 'character', names: ['服部平蔵'], colors: ['緑'], level: 7, ap: 6000, lp: 1,
  traits: ['警察', '大阪府警'], keywords: [], rarity: 'R', imageUrl: '1775608819106090.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
