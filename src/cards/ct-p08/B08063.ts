// cards/ct-p08/B08063 黒田兵衛 (character)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  continuousModifier: { grantTraits: ['長野県警'] },
  description: '現場にいるこのキャラは〚特徴［長野県警］〛を持つ。',
  ruleRefs: ['rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '長野県警' }, distinctNames: true }, nMin: 3 },
    then: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ] },
  },
  description: '自分のターン終了時、自分の現場にそれぞれカード名の異なる〚特徴［長野県警］〛のキャラが3枚以上いる場合、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '黄' },
  effect: {
    kind: 'optional', effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true, bind: '$milled' } },
      {
        kind: 'conditional',
        if: { kind: 'boundAnyMatchesFilter', bindKey: '$milled', filter: { trait: '長野県警', kind: 'character' } },
        then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
      },
    ] },
  },
  description: '【パートナー黄】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。この効果によって〚特徴［長野県警］〛のキャラがリムーブされた場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B08063: CardDef = {
  id: 'B08063', no: '0900/B08063', kind: 'character', names: ['黒田兵衛'], colors: ['黄'],
  level: 8, ap: 7000, lp: 2, traits: ['警察', '警視庁'], keywords: [], rarity: 'SR',
  imageUrl: '1770731238703951.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};
