// cards/ct-p04/B04030P 黒羽快斗 (キャラ パラレル) — engine-extension #1 leave:to-remove batch #2 (a2 only)
// B04030 と同型 (rarity SRP / imageUrl のみ差分)
// a1 (action 終了時 deck-look-4 + choice + 自己リムーブ) は DEFERRED

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', max: 1, side: 'either', state: 'stun', filter: { levelMax: 8 } },
  },
  description: '【相手ターン中】【現場リムーブ時】レベル8以下のキャラを1枚までスタン。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04030P: CardDef = {
  id: 'B04030P',
  no: '0428/B04030P',
  kind: 'character',
  names: ['黒羽快斗'],
  colors: ['白'],
  level: 8, ap: 7000, lp: 1,
  traits: ['高校生', 'マジシャン'], keywords: [],
  rarity: 'SRP',
  imageUrl: '1735287759454930.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
