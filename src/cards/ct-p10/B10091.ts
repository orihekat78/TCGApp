// CT-P10 B10091 カルバドス — rules: 09-cutin-disguise, 15-abilities-effects, 17-icons
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '黒', cutinTextIncludes: '' } }, nMin: 4 },
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '自分の現場に【カットイン】を持つ【黒】のキャラが4枚以上いる場合、このキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' },
  condition: { kind: 'charTurnEffect', key: 'enteredByCutinEffectThisTurn' },
  effect: { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'self', max: 1, pos: 'bottom' } },
  description: 'ターン終了時、このターン中にこのキャラが【カットイン】の効果によって登場していた場合、自分の現場にいるキャラを1枚選び、デッキの下に移す。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'and', cs: [
    { kind: 'partnerColor', color: '黒' },
    { kind: 'turn', player: 'self' },
    { kind: 'contactCharMatches', who: 'byUid', filter: { kind: 'character', color: '黒', levelMin: 8, cutinTextIncludes: '' } },
  ] },
  effect: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$trigger.cardId', from: 'remove', viaEffect: true, sourceRequired: true, target: { query: { area: 'remove', side: 'self' } } } },
  description: '【カットイン】【パートナー黒】【自分ターン中】【カットイン】を持つレベル8以上の【黒】のキャラに【カットイン】した場合、このキャラをリムーブエリアから登場させる。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10091: CardDef = {
  id: 'B10091', no: '1146/B10091', kind: 'character', names: ['カルバドス'], colors: ['黒'], level: 7, ap: 6000, lp: 0,
  traits: ['黒ずくめの組織'], keywords: [], rarity: 'C', imageUrl: '1783904232352336.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
