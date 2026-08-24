import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence', steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, bind: 'entered', filter: { kind: 'character', color: '白', levelMax: { dyn: '$self.fileCount' } } } },
      { kind: 'conditional', if: { kind: 'bound', key: 'entered', presence: 'exists' }, then: {
        kind: 'optional', effect: { kind: 'chain', steps: [
          { kind: 'atom', verb: 'bindPick', args: { player: 'self', max: 1, side: 'self', bind: 'nameSource', filter: { kind: 'character', levelMax: 8 }, excludeBound: 'entered' } },
          { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$entered.uid', key: 'nameOverride', val: '$nameSource.cardName' } },
        ] },
      } },
    ],
  },
  description: 'カードを1枚引き、手札から自分のFILEエリアの枚数以下のレベルの【白】のキャラを1枚まで登場させる。ターン終了時までそのキャラのカード名を、自分の現場にいるそのキャラ以外のレベル8以下のキャラ1枚のカード名に書き換えてもよい。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'declareName', args: { bind: 'named', domain: 'registered-card-name' } },
    { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$declared.named.sceneNameCount * 1000' }, scope: 'contact' } },
  ] },
  description: '【カットイン】【自分ターン中】カード名を1つ指定し、自分の現場にいる指定したカード名のキャラ1枚につき、AP＋1000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/22-qa-action-contact.md'],
};

export const B09052: CardDef = {
  id: 'B09052', no: '0995/B09052', kind: 'event', names: ['い、いつの間に!?'], colors: ['白'], level: 2, traits: [], rarity: 'C', imageUrl: '1775608856224527.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/22-qa-action-contact.md'],
};
