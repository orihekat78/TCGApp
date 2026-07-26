// rules: 15-abilities-effects.md, 16-card-set.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef, Condition } from '@/engine/types';

const setOnSoccer = {
  kind: 'atom' as const,
  verb: 'charSetCard' as const,
  args: { player: 'self' as const, fromSelf: true, n: 1, filter: { kind: 'character' as const, trait: 'サッカー' } },
};

const noGadgetInScene: Condition = {
  kind: 'not' as const,
  c: {
    kind: 'sceneHas' as const,
    query: { area: ['scene', 'set-card'] as Array<'scene' | 'set-card'>, side: 'self', filter: { trait: 'ガジェット' } },
    nMin: 1,
  },
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: setOnSoccer,
  description: 'このイベントを自分の現場にいる〚特徴［サッカー］〛のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-set-host',
  trigger: { hook: 'setcard:enter', selfOnly: true, matcherCondition: { kind: 'setCardMatches', filter: { cardName: 'どこでもボール射出ベルト' } } },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', player: 'self', fromDeckTop: true, faceUp: true } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ] },
  description: 'このイベントが〚特徴［サッカー］〛のキャラにセットされたとき、デッキのカードを上から1枚表向きでこのキャラにセットし、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'declared', scope: 'on-hand',
  condition: { kind: 'and', cs: [{ kind: 'fileAtLeast', n: 8 }, noGadgetInScene] },
  effect: setOnSoccer,
  description: '【FILE8】【宣言】手札からこのイベントを自分の現場にいる〚特徴［サッカー］〛のキャラ1枚にセットする。この能力は自分の現場に〚特徴［ガジェット］〛のカードがない場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B10018: CardDef = {
  id: 'B10018', no: '1080/B10018', kind: 'event', names: ['どこでもボール射出ベルト'], colors: ['青'], level: 1,
  traits: [], rarity: 'C', imageUrl: '1783904095009608.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B10018P: CardDef = { ...B10018, id: 'B10018P', no: '1080/B10018P', rarity: 'CP', imageUrl: '1783904095018341.jpg' };
