# 🤖 Engine (types/read/mutate) → ルール マッピング

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `e45505485a1d`

`// rules: NN-name.md, ...` コメントから抽出。ファイル容量制約のためエリア別に分割。

このグループ: **38** ファイル（[全体 index](./index.md)）

## engine/types (10)

| ソース | 参照ルール |
| ------ | --------- |
| [`src/engine/types/candidate.ts`](../../../src/engine/types/candidate.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`08-contact.md`](../../rules/08-contact.md) / [`11-reasoning.md`](../../rules/11-reasoning.md) |
| [`src/engine/types/card-def.ts`](../../../src/engine/types/card-def.ts) | [`02-deck-construction.md`](../../rules/02-deck-construction.md) / [`06-card-types.md`](../../rules/06-card-types.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) / [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) |
| [`src/engine/types/effect-ctx.ts`](../../../src/engine/types/effect-ctx.ts) | [`08-contact.md`](../../rules/08-contact.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |
| [`src/engine/types/effect-stack.ts`](../../../src/engine/types/effect-stack.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`22-qa-action-contact.md`](../../rules/22-qa-action-contact.md) / [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) |
| [`src/engine/types/effect.ts`](../../../src/engine/types/effect.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`08-contact.md`](../../rules/08-contact.md) / [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) / [`11-reasoning.md`](../../rules/11-reasoning.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`14-refresh.md`](../../rules/14-refresh.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |
| [`src/engine/types/game-state.ts`](../../../src/engine/types/game-state.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`03-field-areas.md`](../../rules/03-field-areas.md) / [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`14-refresh.md`](../../rules/14-refresh.md) |
| [`src/engine/types/hooks.ts`](../../../src/engine/types/hooks.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`07-action-flow.md`](../../rules/07-action-flow.md) / [`08-contact.md`](../../rules/08-contact.md) / [`11-reasoning.md`](../../rules/11-reasoning.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`14-refresh.md`](../../rules/14-refresh.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/engine/types/index.ts`](../../../src/engine/types/index.ts) | _(参照なし)_ |
| [`src/engine/types/reserved-effect.ts`](../../../src/engine/types/reserved-effect.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |
| [`src/engine/types/results.ts`](../../../src/engine/types/results.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`08-contact.md`](../../rules/08-contact.md) / [`14-refresh.md`](../../rules/14-refresh.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |

## engine/read (13)

| ソース | 参照ルール |
| ------ | --------- |
| [`src/engine/read/char.ts`](../../../src/engine/read/char.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`11-reasoning.md`](../../rules/11-reasoning.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) |
| [`src/engine/read/def.ts`](../../../src/engine/read/def.ts) | [`02-deck-construction.md`](../../rules/02-deck-construction.md) / [`06-card-types.md`](../../rules/06-card-types.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) |
| [`src/engine/read/effect-source.ts`](../../../src/engine/read/effect-source.ts) | _(参照なし)_ |
| [`src/engine/read/game.ts`](../../../src/engine/read/game.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`14-refresh.md`](../../rules/14-refresh.md) |
| [`src/engine/read/hand-cutin.ts`](../../../src/engine/read/hand-cutin.ts) | [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) / [`17-icons.md`](../../rules/17-icons.md) |
| [`src/engine/read/index.ts`](../../../src/engine/read/index.ts) | _(参照なし)_ |
| [`src/engine/read/keyword.ts`](../../../src/engine/read/keyword.ts) | [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) / [`10-action-event.md`](../../rules/10-action-event.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`17-icons.md`](../../rules/17-icons.md) |
| [`src/engine/read/log.ts`](../../../src/engine/read/log.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) |
| [`src/engine/read/player.ts`](../../../src/engine/read/player.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`12-next-hint.md`](../../rules/12-next-hint.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`17-icons.md`](../../rules/17-icons.md) |
| [`src/engine/read/scene-cap.ts`](../../../src/engine/read/scene-cap.ts) | [`26-07-02.md`](../../rules/26-07-02.md) |
| [`src/engine/read/scene.ts`](../../../src/engine/read/scene.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`13-keywords.md`](../../rules/13-keywords.md) |
| [`src/engine/read/triggered-aura.ts`](../../../src/engine/read/triggered-aura.ts) | _(参照なし)_ |
| [`src/engine/read/turn.ts`](../../../src/engine/read/turn.ts) | [`04-game-setup.md`](../../rules/04-game-setup.md) / [`05-turn-phases.md`](../../rules/05-turn-phases.md) |

## engine/mutate (15)

| ソース | 参照ルール |
| ------ | --------- |
| [`src/engine/mutate/action-scopes.ts`](../../../src/engine/mutate/action-scopes.ts) | _(参照なし)_ |
| [`src/engine/mutate/case.ts`](../../../src/engine/mutate/case.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`06-card-types.md`](../../rules/06-card-types.md) / [`13-keywords.md`](../../rules/13-keywords.md) |
| [`src/engine/mutate/char.ts`](../../../src/engine/mutate/char.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) |
| [`src/engine/mutate/deck.ts`](../../../src/engine/mutate/deck.ts) | [`13-keywords.md`](../../rules/13-keywords.md) / [`14-refresh.md`](../../rules/14-refresh.md) / [`26-qa-deck-refresh.md`](../../rules/26-qa-deck-refresh.md) |
| [`src/engine/mutate/evidence.ts`](../../../src/engine/mutate/evidence.ts) | [`10-action-event.md`](../../rules/10-action-event.md) / [`11-reasoning.md`](../../rules/11-reasoning.md) / [`14-refresh.md`](../../rules/14-refresh.md) |
| [`src/engine/mutate/file.ts`](../../../src/engine/mutate/file.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`12-next-hint.md`](../../rules/12-next-hint.md) / [`13-keywords.md`](../../rules/13-keywords.md) |
| [`src/engine/mutate/flag.ts`](../../../src/engine/mutate/flag.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`12-next-hint.md`](../../rules/12-next-hint.md) / [`13-keywords.md`](../../rules/13-keywords.md) |
| [`src/engine/mutate/gameResult.ts`](../../../src/engine/mutate/gameResult.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`14-refresh.md`](../../rules/14-refresh.md) |
| [`src/engine/mutate/hand.ts`](../../../src/engine/mutate/hand.ts) | [`04-game-setup.md`](../../rules/04-game-setup.md) / [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`12-next-hint.md`](../../rules/12-next-hint.md) |
| [`src/engine/mutate/index.ts`](../../../src/engine/mutate/index.ts) | _(参照なし)_ |
| [`src/engine/mutate/log.ts`](../../../src/engine/mutate/log.ts) | _(参照なし)_ |
| [`src/engine/mutate/partner.ts`](../../../src/engine/mutate/partner.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`18-mr.md`](../../rules/18-mr.md) |
| [`src/engine/mutate/remove.ts`](../../../src/engine/mutate/remove.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`14-refresh.md`](../../rules/14-refresh.md) |
| [`src/engine/mutate/scene.ts`](../../../src/engine/mutate/scene.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) / [`16-card-set.md`](../../rules/16-card-set.md) / [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) |
| [`src/engine/mutate/scratchTrace.ts`](../../../src/engine/mutate/scratchTrace.ts) | [`13-keywords.md`](../../rules/13-keywords.md) / [`26-qa-deck-refresh.md`](../../rules/26-qa-deck-refresh.md) |
