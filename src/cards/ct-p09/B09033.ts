// cards/ct-p09/B09033 「ひょっとしたら…」 (event)
// rules: 06-card-types.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
// grounding: .claude/specs/grounding/B09033.md

import type { AbilityDef, CardDef, Effect } from '@/engine/types';

const windowEnter = (): Effect => ({
  kind: 'atom',
  verb: 'sceneEnter',
  args: {
    player: 'self', cardIds: '$pick.cardIds', skipResolvesAtom: true, viaEffect: true,
    target: {
      kind: 'pick',
      query: { area: 'deck', side: 'self', fromGroupCards: '$revealed', filter: { kind: 'character', trait: '高校生', levelMax: 6 } },
      n: { min: 0, max: 1 }, chooser: 'self',
    },
  },
});

const repeat: Effect = { kind: 'repeatOptional', max: 3, body: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'fileRemoveTop', args: { player: 'self', n: 1 } }, windowEnter()] } };

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 4, bind: '$revealed' } },
      windowEnter(),
      repeat,
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '自分のデッキのカードを上から4枚公開し、その中からレベル6以下の〚特徴［高校生］〛のキャラを1枚まで登場させる。「自分のFILEエリアにあるカードを上から1枚リムーブし、公開したカードの中からレベル6以下の〚特徴［高校生］〛のキャラを1枚まで登場させる。」を3回まで行ってよい。その後、公開したカードの残りを好きな順番でデッキの下に移す。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

export const B09033: CardDef = {
  id: 'B09033', no: '0977/B09033', kind: 'event', names: ['「ひょっとしたら…」'], colors: ['緑'], level: 6,
  traits: [], rarity: 'C', imageUrl: '1775608835848408.jpg', abilities: [a1],
  ruleRefs: ['rules/06-card-types.md', 'rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};
