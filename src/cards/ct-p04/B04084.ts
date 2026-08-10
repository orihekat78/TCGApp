import type { AbilityDef, CardDef } from '@/engine/types';

const policeRemovePick = {
  kind: 'pick' as const,
  query: {
    area: 'remove' as const,
    side: 'self' as const,
    filter: { kind: 'character' as const, trait: '警察', levelMax: 8 },
    aggregateLevelMax: 10,
  },
  n: { min: 0, max: 2 },
  chooser: 'self' as const,
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黄' },
      { kind: 'caseStatus', status: '解決編' },
    ],
  },
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2, minimumPolicy: 'exact' } },
        {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'bindPick', args: { player: 'self', cardIds: '$pick.cardIds', bind: '$selected', target: policeRemovePick } },
            {
              kind: 'atom',
              verb: 'sceneEnter',
              args: {
                player: 'self', cardId: '$pick.cardId', from: 'remove', viaEffect: true,
                target: {
                  kind: 'pick',
                  query: { ...policeRemovePick.query, fromGroupCards: '$selected' },
                  n: { min: 1, max: 1 }, chooser: 'self',
                },
              },
            },
            {
              kind: 'atom',
              verb: 'sceneEnter',
              args: {
                player: 'self', cardIds: '$pick.cardIds', from: 'remove', viaEffect: true, enterSleep: true,
                target: {
                  kind: 'pick',
                  query: { ...policeRemovePick.query, fromGroupCards: '$selected' },
                  n: { min: 0, max: 2 }, chooser: 'self',
                },
              },
            },
          ],
        },
      ],
    },
  },
  description: '【パートナー黄】【解決編】手札を2枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル8以下の〚特徴［警察］〛のキャラをレベルの合計が10以下になるように2枚まで選ぶ。その中から1枚を登場させ、残りをスリープ状態で登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/25-qa-effects-resolution.md'],
};

export const B04084: CardDef = {
  id: 'B04084',
  no: '0468/B04084',
  kind: 'event',
  names: ['バカな作戦'],
  colors: ['黄'],
  level: 8,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287841263646.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/25-qa-effects-resolution.md'],
};
