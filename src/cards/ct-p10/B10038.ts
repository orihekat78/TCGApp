import type { AbilityDef, CardDef } from '@/engine/types';

const reentryRider = {
  id: 'b10038_reentry_rider',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { kind: 'character', levelMax: 3 } },
  },
  description: '【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、自分のリムーブエリアにあるレベル3以下のキャラを1枚まで選び、登場させる。',
} as const;

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'enterSource', viaEffect: true, side: 'self', sourceFilter: { kind: 'character' } },
  effect: { kind: 'atom', verb: 'charGrantAbility', args: { uid: '$self', scope: 'turn', ability: reentryRider } },
  description: '【登場時】自分のキャラの能力によって登場した場合、ターン終了時までこのキャラは「【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、自分のリムーブエリアにあるレベル3以下のキャラを1枚まで選び、登場させる。」を持つ。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'choice', chooser: 'self', options: [
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B10038: CardDef = {
  id: 'B10038', no: '1098/B10038', kind: 'character', names: ['黒羽快斗'],
  nameAliasesByArea: { deck: ['怪盗キッド'], remove: ['怪盗キッド'] },
  colors: ['白'], level: 8, ap: 7000, lp: 2, traits: ['高校生', 'マジシャン'], keywords: ['突撃'], rarity: 'R',
  imageUrl: '1783904137974221.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/08-contact.md', 'rules/10-action-event.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B10038P: CardDef = { ...B10038, id: 'B10038P', no: '1098/B10038P', rarity: 'RP', imageUrl: '1783904137981170.jpg' };
