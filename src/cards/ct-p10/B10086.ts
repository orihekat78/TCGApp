// CT-P10 B10086 スコッチ
// rules: 08-contact.md, 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const cutinBanForTurn: AbilityDef = {
  id: 'b10086-cutin-ban',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: { selfCutinBanInContact: true },
  description: 'このキャラのコンタクト中に自分は【カットイン】を使用できない。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md'],
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'and', cs: [
    { kind: 'partnerColor', color: '黒' },
    { kind: 'turn', player: 'self' },
  ] },
  trigger: { hook: 'cutin:used', matcherCondition: { kind: 'and', cs: [
    { kind: 'triggerPlayerIs', side: 'self' },
    { kind: 'triggerCutinMatches', filter: { kind: 'character', cardName: 'バーボン' } },
    { kind: 'contactCharMatches', who: 'byUid', requireSource: true, filter: { kind: 'character' } },
  ] } },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
    { kind: 'atom', verb: 'charGrantAbility', args: { uid: '$self', scope: 'turn', ability: cutinBanForTurn } },
  ] },
  description: '【パートナー黒】【自分ターン中】【ターン1】このキャラのコンタクト中に自分が〚カード名［バーボン］〛の【カットイン】を使用したとき、このキャラをアクティブにし、ターン終了時まで「このキャラのコンタクト中に自分は【カットイン】を使用できない。」を持つ。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand',
  condition: { kind: 'turn', player: 'self' },
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
    { kind: 'conditional', if: { kind: 'contactCharMatches', who: 'byUid', filter: { kind: 'character', color: '黒', keyword: 'カットイン' } }, then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
  ] },
  description: '【カットイン】AP＋1000、【カットイン】を持つ【黒】のキャラに【カットイン】した場合、カードを1枚引く。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};

export const B10086: CardDef = {
  id: 'B10086', no: '1141/B10086', kind: 'character', names: ['スコッチ'], colors: ['黒'], level: 8, ap: 8000, lp: 2,
  traits: ['黒ずくめの組織'], keywords: ['突撃'], rarity: 'SR', imageUrl: '1783904232297100.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10086P: CardDef = { ...B10086, id: 'B10086P', no: '1141/B10086P', rarity: 'SRP', imageUrl: '1783904232308598.jpg' };
