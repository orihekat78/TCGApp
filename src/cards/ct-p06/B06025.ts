// rules: rules/10-action-event.md, rules/03-field-areas.md, rules/15-abilities-effects.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'YAIBA' }, excludeSelf: true }, nMin: 1 },
    then: {
      kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
        { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
      ],
    },
  },
  description: '【登場時】このキャラ以外の現場にいる〚特徴［YAIBA］〛のキャラがいる場合、ターン終了時までこのキャラは〚突撃〛を持つか、ターン終了時までこのキャラをAP＋1000する。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'self', cause: 'effect', gateOnMissing: true, filter: { kind: 'character' } } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$occurrence.cardId', selectedCardIndex: '$occurrence.index', exactSelectedCardIndex: true, sourceRequired: true, target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' } } },
    ],
  },
  description: '【ヒラメキ】自分の現場にいるキャラを1枚まで選び、リムーブしてもよい。リムーブした場合、このキャラを登場させる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md', 'rules/15-abilities-effects.md'],
};

export const B06025: CardDef = {
  id: 'B06025', no: '0648/B06025', kind: 'character', names: ['ケロ介'], colors: ['緑'], level: 5, ap: 5000, lp: 0,
  traits: ['YAIBA'], keywords: [], rarity: 'C', imageUrl: '1754285189405499.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md', 'rules/15-abilities-effects.md'],
};
