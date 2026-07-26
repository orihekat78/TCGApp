// CT-P10 B10048 「真さんガンバッてー♡」
// rules: 08-contact.md, 15-abilities-effects.md, 16-card-set.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'atom', verb: 'charGrantAbility', args: {
      player: 'self', side: 'self', max: 5, filter: { kind: 'character' }, scope: 'turn',
      ability: {
        trigger: { hook: 'contact:start', selfOnly: true },
        effect: { kind: 'sequence', steps: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'contact' } },
        ] },
        description: 'このキャラがコンタクトしたとき、カードを1枚引き、そのコンタクト中、そのキャラをAP＋1000する。',
      },
    },
  },
  description: '自分の現場にいるキャラを好きな数選び、ターン終了時まで「このキャラがコンタクトしたとき、カードを1枚引き、そのコンタクト中、そのキャラをAP＋1000する。」を与える。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

export const B10048: CardDef = {
  id: 'B10048', no: '1108/B10048', kind: 'event', names: ['「真さんガンバッてー♡」'], colors: ['白'], level: 5,
  traits: [], keywords: [], rarity: 'C', imageUrl: '1783904138058961.jpg', abilities: [a1],
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};
export const B10048P: CardDef = { ...B10048, id: 'B10048P', no: '1108/B10048P', rarity: 'CP', imageUrl: '1783904138065604.jpg' };
