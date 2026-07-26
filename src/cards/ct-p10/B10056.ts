// CT-P10 B10056 勝又水菜
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: {
    apDeltaAura: 1000,
    auraFilter: { kind: 'character', traitAll: ['女流棋士', '棋士'] },
    auraExcludeSelf: true,
  },
  description: '【自分ターン中】自分の現場にいるこのキャラ以外の〚特徴［女流棋士］〛と〚［棋士］〛のキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { kind: 'character', trait: ['女流棋士', '棋士'] } },
  },
  description: '【ヒラメキ】自分のリムーブエリアにある〚特徴［女流棋士］〛か〚［棋士］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B10056: CardDef = {
  id: 'B10056', no: '1115/B10056', kind: 'character', names: ['勝又水菜'], colors: ['赤'], level: 4, ap: 4000, lp: 1,
  traits: ['女流棋士'], keywords: [], rarity: 'C', imageUrl: '1783904159440675.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
