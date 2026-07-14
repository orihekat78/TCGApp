// rules: 10-action-event.md, 13-keywords.md, 15-abilities-effects.md
import type { AbilityDef, CardDef } from '@/engine/types';

const grant = (kw: string) => ({
  kind: 'atom' as const,
  verb: 'charGrantKeyword' as const,
  args: { player: 'self', max: 1, side: 'either', kw, scope: 'turn' },
});

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'choice', chooser: 'self', options: [
      {
        // Select the [character] grant. Removing Camel replaces that selected
        // resolution with all three grants; declining still resolves it.
        kind: 'sequence', steps: [
          { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { kind: 'character', cardName: 'アンドレ・キャメル' }, bind: '$camel' } },
          { kind: 'conditional', if: { kind: 'bound', key: '$camel', presence: 'matched' }, then: { kind: 'sequence', steps: [grant('突撃[キャラ]'), grant('突撃[事件]'), grant('ブレット')] }, else: grant('突撃[キャラ]') },
        ],
      },
      grant('突撃[事件]'),
      grant('ブレット'),
    ],
  },
  description: '以下から1つ選んで行う。手札から〚カード名［アンドレ・キャメル］〛を1枚リムーブしてもよい。そうした場合、代わりに3つとも行う。（上から順に行う）\n・キャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。\n・キャラを1枚まで選び、ターン終了時まで〚突撃［事件］〛を与える。\n・キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};

export const B09067: CardDef = {
  id: 'B09067', no: '1009/B09067', kind: 'event', names: ['「よしキャメル…走れ!!」'], colors: ['赤'], level: 5,
  traits: [], rarity: 'C', imageUrl: '1775608890049400.jpg', abilities: [a1],
  ruleRefs: ['rules/10-action-event.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};
