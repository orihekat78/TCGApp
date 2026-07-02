// cards/ct-p08/B08043P 手のこんだ悪巧み (イベント・パラレル) — engine additive wave-14 (2026-07-02)
// rules: 03-field-areas.md, 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト (B08043 と同一効果。P 版は cardNum / rarity / imageUrl のみ異なる — TSV 全文比較で effect 完全一致):
//   相手の現場にいるキャラを1枚まで選ぶ。そのキャラが自分の現場にいるLPがもっとも高いキャラのLP以下のLPの場合、リムーブする。
//
// 句マッピング: B08043.ts と同一 (同テキスト別ファイル full def 慣行 — B09096P / B04068P 同様)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'opp',
      cause: 'effect',
      filter: { lpMax: { dyn: '$self.sceneMaxLp' } },
    },
  },
  description:
    '相手の現場にいるキャラを1枚まで選ぶ。そのキャラが自分の現場にいるLPがもっとも高いキャラのLP以下のLPの場合、リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
  ],
};

export const B08043P: CardDef = {
  id: 'B08043P',
  no: '0882/B08043P',
  kind: 'event',
  names: ['手のこんだ悪巧み'],
  colors: ['白'],
  level: 5,
  traits: [],
  rarity: 'CP',
  imageUrl: '1770878966482864.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
