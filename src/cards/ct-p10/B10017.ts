import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 8000 } } },
    { kind: 'atom', verb: 'charSetCard', args: { player: 'self', fromSelf: true, n: 1, filter: { kind: 'character', cardName: '江戸川コナン' } } },
  ] },
  description: '【パートナー青】AP8000以下のキャラを1枚まで選び、リムーブする。このイベントを自分の現場にいる〚カード名［江戸川コナン］〛1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-set-host', limit: { kind: 'turn', n: 1 },
  cost: { kind: 'removeSetCard', n: 1, face: 'up', filter: { cardName: 'どこでもボール射出ベルト' }, hostSelf: true },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMin: 8000 } } },
  description: '【宣言】【ターン1】〚このキャラにセットされている〚カード名［どこでもボール射出ベルト］〛を1枚リムーブする〛：AP8000以上のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
const a3: AbilityDef = { id: 'a3', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', selfOnly: true, optional: true }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } }, description: '【カットイン】【自分ターン中】AP＋3000（自分のターンのコンタクト中に手札からリムーブして使う）', ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'] };
export const B10017: CardDef = { id: 'B10017', no: '1079/B10017', kind: 'event', names: ['キック力増強シューズ'], colors: ['青'], level: 6, traits: [], rarity: 'C', imageUrl: '1783904094995853.jpg', abilities: [a1, a2, a3], ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'] };
export const B10017P: CardDef = { ...B10017, id: 'B10017P', no: '1079/B10017P', rarity: 'CP', imageUrl: '1783904095002056.jpg' };
