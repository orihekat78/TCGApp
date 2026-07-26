// CT-P10 B10032 「神妙にして、縛に就けや!!!」
// rules: 13-keywords.md, 15-abilities-effects.md, 20-color-and-switch.md
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use' },
  condition: { kind: 'partnerColor', color: '緑' },
  effect: {
    kind: 'sequence', steps: [
      {
        kind: 'atom', verb: 'charGrantKeyword', args: {
          uid: '$pick', kw: '突撃[キャラ]', scope: 'turn',
          target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { color: '緑', trait: '警察' } }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', viaEffect: true, max: 1, filter: { kind: 'character', color: '緑', trait: '警察', levelMax: 3 } } },
    ],
  },
  description: '【パートナー緑】自分の現場にいる【緑】の〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。自分のリムーブエリアにあるレベル3以下の【緑】の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};

export const B10032: CardDef = {
  id: 'B10032', no: '1093/B10032', kind: 'event', names: ['「神妙にして、縛に就けや!!!」'], colors: ['緑'], level: 6,
  traits: [], rarity: 'C', imageUrl: '1783904116896481.jpg', abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};
export const B10032P: CardDef = { ...B10032, id: 'B10032P', no: '1093/B10032P', rarity: 'CP', imageUrl: '1783904116903719.jpg' };
