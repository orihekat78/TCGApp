import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '緑' },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'handReveal', args: { player: 'self', audience: 'all', lifetime: 'effect', max: 1, bind: '$revealed', filter: { kind: 'character', trait: '警察' } } },
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 8000 } } },
  ] },
  description: '【パートナー緑】【登場時】手札から〚特徴［警察］〛のキャラを1枚公開してもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'charSetCard', args: { player: 'self', side: 'self', max: 1, fromDeckTop: true, faceUp: false, filter: { kind: 'character', trait: '警察' } } },
  description: '【宣言】【スリープ】：自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、デッキのカードを上から1枚裏向きでセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'choice', chooser: 'self', options: [
    { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
  ] },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B10024: CardDef = {
  id: 'B10024', no: '1085/B10024', kind: 'character', names: ['大滝悟郎'], colors: ['緑'], level: 8, ap: 8000, lp: 1,
  traits: ['警察', '大阪府警'], rarity: 'R', imageUrl: '1783904095098101.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B10024P: CardDef = { ...B10024, id: 'B10024P', no: '1085/B10024P', rarity: 'RP', imageUrl: '1783904116821222.jpg' };
