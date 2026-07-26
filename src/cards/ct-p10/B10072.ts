// CT-P10 B10072 アラン・カッセル (character)
// rules: 10-action-event, 14-refresh, 15-abilities-effects, 17-icons, 21-declared-ability-cost, 26-qa-deck-refresh

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'selfToDeckBottom' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          visibility: 'public', viewer: 'all', player: 'self',
          filter: { kind: 'character', levelMin: 4, levelMax: 5 },
          filterAny: [{ trait: '喫茶ポアロ' }, { trait: '警察' }, { trait: '少年探偵団' }],
          bind: '$revealed', bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description: '【宣言】〚デッキの下に移す〛：自分のデッキのカードを上からレベル4か5の〚特徴［喫茶ポアロ］〛か〚［警察］〛か〚［少年探偵団］〛のキャラが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick', state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B10072: CardDef = {
  id: 'B10072', no: '1128/B10072', kind: 'character', names: ['アラン・カッセル'],
  colors: ['黄'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
  imageUrl: '1783904202625012.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};
