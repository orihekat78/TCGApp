// cards/ct-p08/B08017 「どうしてお姉ちゃんを…助けてくれなかったの？」 (event)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/20-color-and-switch.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  condition: { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown }).kind === 'event-use' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$pick.cardId', from: 'remove', viaEffect: true, bind: '$matched', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { cardName: '江戸川コナン', levelMax: 7, kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    { kind: 'atom', verb: 'charSetCard', args: { uid: '$matched.uid', player: 'self', fromSelf: true } },
  ] },
  description: '【事件青＆黒】自分のリムーブエリアにあるレベル7以下の〚カード名［江戸川コナン］〛を1枚まで選び、登場させる。このイベントをそのキャラにセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'continuous', scope: 'on-set-host',
  condition: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' },
  continuousModifier: { untargetableByOppEffectAura: { cardName: '灰原哀' } },
  description: 'このイベントがセットされているキャラは「このキャラがスリープ状態の場合、自分の現場にいる〚カード名［灰原哀］〛は相手の能力や効果によって選ばれない。」を持つ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

export const B08017: CardDef = {
  id: 'B08017', no: '0858/B08017', kind: 'event', names: ['「どうしてお姉ちゃんを…助けてくれなかったの？」'], colors: ['青'], level: 8,
  traits: [], keywords: [], rarity: 'C', imageUrl: '1770731204409927.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/20-color-and-switch.md'],
};
