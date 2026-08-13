# 🤖 Engine ハブ: engine.flow

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `e7eca1947101`

`src/engine/flow/` 配下のソースが参照している rules / specs / 関連 API リファレンスのハブ。

## 🔗 API リファレンス

- [`auto/api/flow.md`](../../api/flow.md)

## 📜 参照 Rule (19)

- [`01-victory-conditions.md`](../by-rule/01-victory-conditions.md)
- [`02-deck-construction.md`](../by-rule/02-deck-construction.md)
- [`03-field-areas.md`](../by-rule/03-field-areas.md)
- [`04-game-setup.md`](../by-rule/04-game-setup.md)
- [`05-turn-phases.md`](../by-rule/05-turn-phases.md)
- [`06-card-types.md`](../by-rule/06-card-types.md)
- [`07-action-flow.md`](../by-rule/07-action-flow.md)
- [`08-contact.md`](../by-rule/08-contact.md)
- [`09-cutin-disguise.md`](../by-rule/09-cutin-disguise.md)
- [`10-action-event.md`](../by-rule/10-action-event.md)
- [`12-next-hint.md`](../by-rule/12-next-hint.md)
- [`13-keywords.md`](../by-rule/13-keywords.md)
- [`15-abilities-effects.md`](../by-rule/15-abilities-effects.md)
- [`17-icons.md`](../by-rule/17-icons.md)
- [`20-color-and-switch.md`](../by-rule/20-color-and-switch.md)
- [`21-declared-ability-cost.md`](../by-rule/21-declared-ability-cost.md)
- [`22-qa-action-contact.md`](../by-rule/22-qa-action-contact.md)
- [`23-qa-disguise-cutin.md`](../by-rule/23-qa-disguise-cutin.md)
- [`24-qa-naming-stun.md`](../by-rule/24-qa-naming-stun.md)

## 📐 参照 Spec (3)

- [`engine-api-flow-contact`](../by-spec/engine-api-flow-contact.md)
- [`engine-api-flow-control`](../by-spec/engine-api-flow-control.md)
- [`engine-api-flow-setup`](../by-spec/engine-api-flow-setup.md)

## 📄 ソース (22)

- [`src/engine/flow/action-case.ts`](../../../../src/engine/flow/action-case.ts)
- [`src/engine/flow/action/causal.ts`](../../../../src/engine/flow/action/causal.ts)
- [`src/engine/flow/action/context-registry.ts`](../../../../src/engine/flow/action/context-registry.ts)
- [`src/engine/flow/action/legacy-replay-compat.ts`](../../../../src/engine/flow/action/legacy-replay-compat.ts)
- [`src/engine/flow/action/order.ts`](../../../../src/engine/flow/action/order.ts)
- [`src/engine/flow/action/state-machine.ts`](../../../../src/engine/flow/action/state-machine.ts)
- [`src/engine/flow/action/target-expander.ts`](../../../../src/engine/flow/action/target-expander.ts)
- [`src/engine/flow/auto-phase.ts`](../../../../src/engine/flow/auto-phase.ts)
- [`src/engine/flow/contact.ts`](../../../../src/engine/flow/contact.ts)
- [`src/engine/flow/guard.ts`](../../../../src/engine/flow/guard.ts)
- [`src/engine/flow/index.ts`](../../../../src/engine/flow/index.ts)
- [`src/engine/flow/main/ability-activate.ts`](../../../../src/engine/flow/main/ability-activate.ts)
- [`src/engine/flow/main/action.ts`](../../../../src/engine/flow/main/action.ts)
- [`src/engine/flow/main/declared-ability.ts`](../../../../src/engine/flow/main/declared-ability.ts)
- [`src/engine/flow/main/declared-cost-params.ts`](../../../../src/engine/flow/main/declared-cost-params.ts)
- [`src/engine/flow/main/hand-use-card.ts`](../../../../src/engine/flow/main/hand-use-card.ts)
- [`src/engine/flow/main/index.ts`](../../../../src/engine/flow/main/index.ts)
- [`src/engine/flow/main/next-hint.ts`](../../../../src/engine/flow/main/next-hint.ts)
- [`src/engine/flow/main/partner-ability.ts`](../../../../src/engine/flow/main/partner-ability.ts)
- [`src/engine/flow/main/reasoning.ts`](../../../../src/engine/flow/main/reasoning.ts)
- _...ほか 2 件_
