// rules: 08-contact.md, 15-abilities-effects.md, 16-card-set.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: { kind: 'atom', verb: 'charSetCard', args: { player: 'self', fromSelf: true, n: 1, filter: { color: '青', kind: 'character' } } },
  description: 'このイベントを自分の現場にいる【青】のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-set-host',
  trigger: { hook: 'contact:start', selfOnly: true },
  condition: { kind: 'charMatches', ref: { kind: 'self' }, filter: { trait: '少年探偵団' } },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'contact' } },
  description: 'このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP+2000する。',
  ruleRefs: ['rules/08-contact.md', 'rules/16-card-set.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-set-self',
  trigger: { hook: 'phase:end:start' },
  effect: {
    kind: 'optional', effect: {
      kind: 'chain', steps: [
        { kind: 'atom', verb: 'charRemoveSetCard', args: { uid: '$self', setCardInstanceId: '$trigger.setCardInstanceId', gateOnMissing: true } },
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, enterSleep: true, viaEffect: true, filter: { kind: 'character', cardName: '阿笠博士', levelMax: 8 } } },
      ],
    },
  },
  description: '自分か相手のターン終了時、キャラにセットされているこのイベントをリムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル8以下の〚カード名［阿笠博士］〛を1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

export const B06012: CardDef = {
  id: 'B06012', no: '0637/B06012', kind: 'event', names: ['石川五右衛門人形'], colors: ['青'], level: 7,
  traits: [], keywords: [], rarity: 'C', imageUrl: '1754284680585465.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};
