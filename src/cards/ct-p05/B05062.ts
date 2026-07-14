import type { AbilityDef, CardDef, Effect } from '@/engine/types';

const reanimateFilter = [
  { kind: 'character' as const, cardName: '京極真', levelMax: 7 },
  { kind: 'character' as const, trait: '鈴木財閥', levelMax: 7 },
];

const drawAndRemoveHand: Effect = {
  kind: 'sequence' as const,
  steps: [
    { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 2 } },
    { kind: 'atom' as const, verb: 'discard', args: { player: 'self', n: 1 } },
  ],
};

const reanimate: Effect = {
  kind: 'atom' as const,
  verb: 'sceneEnter',
  args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filterAny: reanimateFilter },
};

const sleep: Effect = {
  kind: 'atom' as const,
  verb: 'sceneSetState',
  args: { player: 'self', side: 'either', max: 1, state: 'sleep', filter: { kind: 'character', levelMax: 7 } },
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'conditional',
    if: { kind: 'removeFilterAtLeast', player: 'self', filters: reanimateFilter, n: 4 },
    then: { kind: 'sequence', steps: [drawAndRemoveHand, reanimate, sleep] },
    else: { kind: 'choice', chooser: 'self', options: [drawAndRemoveHand, reanimate, sleep] },
  },
  description: '以下から1つ選んで行う。自分のリムーブエリアに〚カード名［京極真］〛か〚特徴［鈴木財閥］〛のキャラが合わせて4枚以上ある場合、代わりに3つとも行う。（上から順に行う）・カードを2枚引き、手札を1枚リムーブする。・自分のリムーブエリアにあるレベル7以下の〚カード名［京極真］〛かレベル7以下の〚特徴［鈴木財閥］〛のキャラを1枚まで選び、登場させる。・レベル7以下のキャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};

export const B05062: CardDef = {
  id: 'B05062', no: '0564/B05062', kind: 'event', names: ['鈴木家と京極真'], colors: ['黒', '黄'], level: 7,
  traits: [], rarity: 'C', imageUrl: '1746628061798819.jpg', abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
