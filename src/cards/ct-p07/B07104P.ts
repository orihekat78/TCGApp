// cards/ct-p07/B07104P ミステリーコースター (パラレル) — B07104 と同型 (絵柄違い・テキスト同一)。engine変更0 wave (2026-06-28)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: { kind: 'partnerColor', color: '黒' },
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect' } },
      { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', kw: '突撃', scope: 'turn', max: 1, side: 'either' } },
      { kind: 'forEach', over: { kind: 'all', query: { area: 'scene', side: 'either' } }, do: { kind: 'atom', verb: 'mill', args: { player: 'self', n: 2 } } },
    ],
  },
  description: '【パートナー黒】キャラを1枚まで選び、リムーブする。キャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。自分と相手の現場にいるキャラ1枚につき、自分のデッキのカードを上から2枚リムーブする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

export const B07104P: CardDef = {
  id: 'B07104P',
  no: '0831/B07104P',
  kind: 'event',
  names: ['ミステリーコースター'],
  colors: ['黒'],
  level: 7,
  traits: [],
  rarity: 'CP',
  imageUrl: '1763546840511222.jpg',
  abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};
