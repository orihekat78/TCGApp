# 🤖 Engine (effect/flow/invariant) → ルール マッピング

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `e45505485a1d`

`// rules: NN-name.md, ...` コメントから抽出。ファイル容量制約のためエリア別に分割。

このグループ: **188** ファイル（[全体 index](./index.md)）

## engine/effect (24)

| ソース | 参照ルール |
| ------ | --------- |
| [`src/engine/effect/apply-pick.ts`](../../../src/engine/effect/apply-pick.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |
| [`src/engine/effect/atom-handlers.ts`](../../../src/engine/effect/atom-handlers.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/engine/effect/atom-handlers/_shared.ts`](../../../src/engine/effect/atom-handlers/_shared.ts) | _(参照なし)_ |
| [`src/engine/effect/atom-handlers/char.ts`](../../../src/engine/effect/atom-handlers/char.ts) | _(参照なし)_ |
| [`src/engine/effect/atom-handlers/core.ts`](../../../src/engine/effect/atom-handlers/core.ts) | _(参照なし)_ |
| [`src/engine/effect/atom-handlers/misc.ts`](../../../src/engine/effect/atom-handlers/misc.ts) | _(参照なし)_ |
| [`src/engine/effect/atom-handlers/picks.ts`](../../../src/engine/effect/atom-handlers/picks.ts) | _(参照なし)_ |
| [`src/engine/effect/atom-handlers/scene.ts`](../../../src/engine/effect/atom-handlers/scene.ts) | _(参照なし)_ |
| [`src/engine/effect/atom-pick-spec.ts`](../../../src/engine/effect/atom-pick-spec.ts) | _(参照なし)_ |
| [`src/engine/effect/consult-choose-intercept.ts`](../../../src/engine/effect/consult-choose-intercept.ts) | _(参照なし)_ |
| [`src/engine/effect/consult-leave-intercept.ts`](../../../src/engine/effect/consult-leave-intercept.ts) | _(参照なし)_ |
| [`src/engine/effect/declared-name-domain.ts`](../../../src/engine/effect/declared-name-domain.ts) | _(参照なし)_ |
| [`src/engine/effect/heuristic-atom-target.ts`](../../../src/engine/effect/heuristic-atom-target.ts) | _(参照なし)_ |
| [`src/engine/effect/index.ts`](../../../src/engine/effect/index.ts) | _(参照なし)_ |
| [`src/engine/effect/invoke-hirameki.ts`](../../../src/engine/effect/invoke-hirameki.ts) | [`10-action-event.md`](../../rules/10-action-event.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`17-icons.md`](../../rules/17-icons.md) |
| [`src/engine/effect/invoke-leave-to-remove.ts`](../../../src/engine/effect/invoke-leave-to-remove.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`17-icons.md`](../../rules/17-icons.md) |
| [`src/engine/effect/pending-runtime-schema.ts`](../../../src/engine/effect/pending-runtime-schema.ts) | _(参照なし)_ |
| [`src/engine/effect/pending-state.ts`](../../../src/engine/effect/pending-state.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) |
| [`src/engine/effect/pick-selection.ts`](../../../src/engine/effect/pick-selection.ts) | _(参照なし)_ |
| [`src/engine/effect/resolve-picks.ts`](../../../src/engine/effect/resolve-picks.ts) | [`10-action-event.md`](../../rules/10-action-event.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/engine/effect/resolver.ts`](../../../src/engine/effect/resolver.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) |
| [`src/engine/effect/runtime-state.ts`](../../../src/engine/effect/runtime-state.ts) | _(参照なし)_ |
| [`src/engine/effect/validate-spec-files.ts`](../../../src/engine/effect/validate-spec-files.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/engine/effect/validate.ts`](../../../src/engine/effect/validate.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |

## engine/flow (22)

| ソース | 参照ルール |
| ------ | --------- |
| [`src/engine/flow/action-case.ts`](../../../src/engine/flow/action-case.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`10-action-event.md`](../../rules/10-action-event.md) |
| [`src/engine/flow/action/causal.ts`](../../../src/engine/flow/action/causal.ts) | _(参照なし)_ |
| [`src/engine/flow/action/context-registry.ts`](../../../src/engine/flow/action/context-registry.ts) | _(参照なし)_ |
| [`src/engine/flow/action/legacy-replay-compat.ts`](../../../src/engine/flow/action/legacy-replay-compat.ts) | _(参照なし)_ |
| [`src/engine/flow/action/order.ts`](../../../src/engine/flow/action/order.ts) | [`08-contact.md`](../../rules/08-contact.md) |
| [`src/engine/flow/action/state-machine.ts`](../../../src/engine/flow/action/state-machine.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`08-contact.md`](../../rules/08-contact.md) / [`22-qa-action-contact.md`](../../rules/22-qa-action-contact.md) |
| [`src/engine/flow/action/target-expander.ts`](../../../src/engine/flow/action/target-expander.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) |
| [`src/engine/flow/auto-phase.ts`](../../../src/engine/flow/auto-phase.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`04-game-setup.md`](../../rules/04-game-setup.md) / [`05-turn-phases.md`](../../rules/05-turn-phases.md) |
| [`src/engine/flow/contact.ts`](../../../src/engine/flow/contact.ts) | [`08-contact.md`](../../rules/08-contact.md) / [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) / [`22-qa-action-contact.md`](../../rules/22-qa-action-contact.md) / [`23-qa-disguise-cutin.md`](../../rules/23-qa-disguise-cutin.md) |
| [`src/engine/flow/guard.ts`](../../../src/engine/flow/guard.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`13-keywords.md`](../../rules/13-keywords.md) / [`24-qa-naming-stun.md`](../../rules/24-qa-naming-stun.md) |
| [`src/engine/flow/index.ts`](../../../src/engine/flow/index.ts) | _(参照なし)_ |
| [`src/engine/flow/main/ability-activate.ts`](../../../src/engine/flow/main/ability-activate.ts) | [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |
| [`src/engine/flow/main/action.ts`](../../../src/engine/flow/main/action.ts) | _(参照なし)_ |
| [`src/engine/flow/main/declared-ability.ts`](../../../src/engine/flow/main/declared-ability.ts) | [`17-icons.md`](../../rules/17-icons.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) / [`24-qa-naming-stun.md`](../../rules/24-qa-naming-stun.md) |
| [`src/engine/flow/main/declared-cost-params.ts`](../../../src/engine/flow/main/declared-cost-params.ts) | _(参照なし)_ |
| [`src/engine/flow/main/hand-use-card.ts`](../../../src/engine/flow/main/hand-use-card.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`12-next-hint.md`](../../rules/12-next-hint.md) / [`17-icons.md`](../../rules/17-icons.md) / [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) |
| [`src/engine/flow/main/index.ts`](../../../src/engine/flow/main/index.ts) | _(参照なし)_ |
| [`src/engine/flow/main/next-hint.ts`](../../../src/engine/flow/main/next-hint.ts) | _(参照なし)_ |
| [`src/engine/flow/main/partner-ability.ts`](../../../src/engine/flow/main/partner-ability.ts) | [`06-card-types.md`](../../rules/06-card-types.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |
| [`src/engine/flow/main/reasoning.ts`](../../../src/engine/flow/main/reasoning.ts) | _(参照なし)_ |
| [`src/engine/flow/setup.ts`](../../../src/engine/flow/setup.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`02-deck-construction.md`](../../rules/02-deck-construction.md) / [`04-game-setup.md`](../../rules/04-game-setup.md) |
| [`src/engine/flow/turn.ts`](../../../src/engine/flow/turn.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |

## engine/invariant (9)

| ソース | 参照ルール |
| ------ | --------- |
| [`src/engine/invariant/caseExists.ts`](../../../src/engine/invariant/caseExists.ts) | _(参照なし)_ |
| [`src/engine/invariant/caseMonotonic.ts`](../../../src/engine/invariant/caseMonotonic.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`06-card-types.md`](../../rules/06-card-types.md) |
| [`src/engine/invariant/effectIsSerializable.ts`](../../../src/engine/invariant/effectIsSerializable.ts) | _(参照なし)_ |
| [`src/engine/invariant/frozenSurface.ts`](../../../src/engine/invariant/frozenSurface.ts) | _(参照なし)_ |
| [`src/engine/invariant/index.ts`](../../../src/engine/invariant/index.ts) | _(参照なし)_ |
| [`src/engine/invariant/partnerExists.ts`](../../../src/engine/invariant/partnerExists.ts) | _(参照なし)_ |
| [`src/engine/invariant/sceneAtMost5.ts`](../../../src/engine/invariant/sceneAtMost5.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) |
| [`src/engine/invariant/scratchTraceMonotonic.ts`](../../../src/engine/invariant/scratchTraceMonotonic.ts) | [`13-keywords.md`](../../rules/13-keywords.md) / [`26-qa-deck-refresh.md`](../../rules/26-qa-deck-refresh.md) |
| [`src/engine/invariant/stunSemantics.ts`](../../../src/engine/invariant/stunSemantics.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) |

## engine (他) (35)

| ソース | 参照ルール |
| ------ | --------- |
| [`src/engine/cards/index.ts`](../../../src/engine/cards/index.ts) | _(参照なし)_ |
| [`src/engine/cards/registry.ts`](../../../src/engine/cards/registry.ts) | [`02-deck-construction.md`](../../rules/02-deck-construction.md) / [`06-card-types.md`](../../rules/06-card-types.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) |
| [`src/engine/cards/tsv-loader-fs.ts`](../../../src/engine/cards/tsv-loader-fs.ts) | [`02-deck-construction.md`](../../rules/02-deck-construction.md) / [`06-card-types.md`](../../rules/06-card-types.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) / [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) |
| [`src/engine/cards/tsv-loader.ts`](../../../src/engine/cards/tsv-loader.ts) | [`02-deck-construction.md`](../../rules/02-deck-construction.md) / [`06-card-types.md`](../../rules/06-card-types.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) / [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) |
| [`src/engine/cond/binding-keys.ts`](../../../src/engine/cond/binding-keys.ts) | _(参照なし)_ |
| [`src/engine/cond/eval.ts`](../../../src/engine/cond/eval.ts) | [`13-keywords.md`](../../rules/13-keywords.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`17-icons.md`](../../rules/17-icons.md) / [`18-mr.md`](../../rules/18-mr.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) / [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) |
| [`src/engine/cond/index.ts`](../../../src/engine/cond/index.ts) | _(参照なし)_ |
| [`src/engine/cost/alternative.ts`](../../../src/engine/cost/alternative.ts) | _(参照なし)_ |
| [`src/engine/cost/evaluate.ts`](../../../src/engine/cost/evaluate.ts) | [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) / [`26-qa-deck-refresh.md`](../../rules/26-qa-deck-refresh.md) |
| [`src/engine/cost/index.ts`](../../../src/engine/cost/index.ts) | _(参照なし)_ |
| [`src/engine/cost/pay.ts`](../../../src/engine/cost/pay.ts) | [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) / [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) |
| [`src/engine/cost/remove-set-card-eligible.ts`](../../../src/engine/cost/remove-set-card-eligible.ts) | _(参照なし)_ |
| [`src/engine/cost/remove-set-card-witness.ts`](../../../src/engine/cost/remove-set-card-witness.ts) | _(参照なし)_ |
| [`src/engine/dyn/eval.ts`](../../../src/engine/dyn/eval.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/engine/dyn/index.ts`](../../../src/engine/dyn/index.ts) | _(参照なし)_ |
| [`src/engine/event/index.ts`](../../../src/engine/event/index.ts) | _(参照なし)_ |
| [`src/engine/event/registry.ts`](../../../src/engine/event/registry.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/engine/index.ts`](../../../src/engine/index.ts) | _(参照なし)_ |
| [`src/engine/listeners/hirameki.ts`](../../../src/engine/listeners/hirameki.ts) | [`10-action-event.md`](../../rules/10-action-event.md) |
| [`src/engine/listeners/misread.ts`](../../../src/engine/listeners/misread.ts) | _(参照なし)_ |
| [`src/engine/listeners/reserved-effects.ts`](../../../src/engine/listeners/reserved-effects.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/engine/listeners/triggered.ts`](../../../src/engine/listeners/triggered.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`17-icons.md`](../../rules/17-icons.md) |
| [`src/engine/log/causal.ts`](../../../src/engine/log/causal.ts) | _(参照なし)_ |
| [`src/engine/log/effect-causal.ts`](../../../src/engine/log/effect-causal.ts) | _(参照なし)_ |
| [`src/engine/produce.ts`](../../../src/engine/produce.ts) | _(参照なし)_ |
| [`src/engine/resolve/index.ts`](../../../src/engine/resolve/index.ts) | _(参照なし)_ |
| [`src/engine/resolve/stack.ts`](../../../src/engine/resolve/stack.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) |
| [`src/engine/rng.ts`](../../../src/engine/rng.ts) | _(参照なし)_ |
| [`src/engine/state-factory.ts`](../../../src/engine/state-factory.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`03-field-areas.md`](../../rules/03-field-areas.md) / [`04-game-setup.md`](../../rules/04-game-setup.md) |
| [`src/engine/state/indexed-zone-epoch.ts`](../../../src/engine/state/indexed-zone-epoch.ts) | _(参照なし)_ |
| [`src/engine/target/candidates.ts`](../../../src/engine/target/candidates.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) |
| [`src/engine/target/card-def-registry.ts`](../../../src/engine/target/card-def-registry.ts) | _(参照なし)_ |
| [`src/engine/target/card-occurrence.ts`](../../../src/engine/target/card-occurrence.ts) | _(参照なし)_ |
| [`src/engine/target/index.ts`](../../../src/engine/target/index.ts) | _(参照なし)_ |
| [`src/engine/target/resolve.ts`](../../../src/engine/target/resolve.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`19-special-rules.md`](../../rules/19-special-rules.md) |

## その他 (98)

| ソース | 参照ルール |
| ------ | --------- |
| [`src/cloud-data/access-auth.ts`](../../../src/cloud-data/access-auth.ts) | _(参照なし)_ |
| [`src/cloud-data/api.ts`](../../../src/cloud-data/api.ts) | _(参照なし)_ |
| [`src/cloud-data/contracts.ts`](../../../src/cloud-data/contracts.ts) | _(参照なし)_ |
| [`src/cloud-data/d1-types.ts`](../../../src/cloud-data/d1-types.ts) | _(参照なし)_ |
| [`src/cloud-data/idempotency.ts`](../../../src/cloud-data/idempotency.ts) | _(参照なし)_ |
| [`src/cloud-data/identity.ts`](../../../src/cloud-data/identity.ts) | _(参照なし)_ |
| [`src/cloud-data/rate-limit.ts`](../../../src/cloud-data/rate-limit.ts) | _(参照なし)_ |
| [`src/cloud-data/repository.ts`](../../../src/cloud-data/repository.ts) | _(参照なし)_ |
| [`src/cloud-data/request-context.ts`](../../../src/cloud-data/request-context.ts) | _(参照なし)_ |
| [`src/cloud-data/retention.ts`](../../../src/cloud-data/retention.ts) | _(参照なし)_ |
| [`src/cloud-data/usage-budget.ts`](../../../src/cloud-data/usage-budget.ts) | _(参照なし)_ |
| [`src/e2e/test-api.ts`](../../../src/e2e/test-api.ts) | _(参照なし)_ |
| [`src/shared/deck-legality-catalog.generated.ts`](../../../src/shared/deck-legality-catalog.generated.ts) | _(参照なし)_ |
| [`src/shared/deck-legality.ts`](../../../src/shared/deck-legality.ts) | _(参照なし)_ |
| [`src/ui/fixtures/bug274PartnerFixture.ts`](../../../src/ui/fixtures/bug274PartnerFixture.ts) | _(参照なし)_ |
| [`src/ui/fixtures/cutinDemoState.ts`](../../../src/ui/fixtures/cutinDemoState.ts) | [`08-contact.md`](../../rules/08-contact.md) / [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) |
| [`src/ui/fixtures/hiramekiDemoState.ts`](../../../src/ui/fixtures/hiramekiDemoState.ts) | [`10-action-event.md`](../../rules/10-action-event.md) |
| [`src/ui/fixtures/sampleGameState.ts`](../../../src/ui/fixtures/sampleGameState.ts) | _(参照なし)_ |
| [`src/ui/hooks/movePresentationDelay.ts`](../../../src/ui/hooks/movePresentationDelay.ts) | _(参照なし)_ |
| [`src/ui/hooks/useActionsPanelFlow.ts`](../../../src/ui/hooks/useActionsPanelFlow.ts) | [`26-05-11-ui-action-flows.md`](../../rules/26-05-11-ui-action-flows.md) |
| [`src/ui/hooks/useActionsPanelFlow/cost.ts`](../../../src/ui/hooks/useActionsPanelFlow/cost.ts) | _(参照なし)_ |
| [`src/ui/hooks/useActionsPanelFlow/end-turn-contract.ts`](../../../src/ui/hooks/useActionsPanelFlow/end-turn-contract.ts) | _(参照なし)_ |
| [`src/ui/hooks/useActionsPanelFlow/enumerators.ts`](../../../src/ui/hooks/useActionsPanelFlow/enumerators.ts) | _(参照なし)_ |
| [`src/ui/hooks/useActionsPanelFlow/flows.ts`](../../../src/ui/hooks/useActionsPanelFlow/flows.ts) | _(参照なし)_ |
| [`src/ui/hooks/useCardExpandModal.ts`](../../../src/ui/hooks/useCardExpandModal.ts) | _(参照なし)_ |
| [`src/ui/hooks/useCardImage.ts`](../../../src/ui/hooks/useCardImage.ts) | _(参照なし)_ |
| [`src/ui/hooks/useCardOrientation.ts`](../../../src/ui/hooks/useCardOrientation.ts) | _(参照なし)_ |
| [`src/ui/hooks/useCase.ts`](../../../src/ui/hooks/useCase.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`06-card-types.md`](../../rules/06-card-types.md) |
| [`src/ui/hooks/useChoicePicker.ts`](../../../src/ui/hooks/useChoicePicker.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/ui/hooks/useConfirmation.ts`](../../../src/ui/hooks/useConfirmation.ts) | [`26-05-11-ui-action-flows.md`](../../rules/26-05-11-ui-action-flows.md) |
| [`src/ui/hooks/useContactFlowDriver.ts`](../../../src/ui/hooks/useContactFlowDriver.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`08-contact.md`](../../rules/08-contact.md) / [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) / [`10-action-event.md`](../../rules/10-action-event.md) / [`22-qa-action-contact.md`](../../rules/22-qa-action-contact.md) / [`23-qa-disguise-cutin.md`](../../rules/23-qa-disguise-cutin.md) / [`24-qa-naming-stun.md`](../../rules/24-qa-naming-stun.md) |
| [`src/ui/hooks/useContactModalStore.ts`](../../../src/ui/hooks/useContactModalStore.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`08-contact.md`](../../rules/08-contact.md) / [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) |
| [`src/ui/hooks/useCutinDemoDriver.ts`](../../../src/ui/hooks/useCutinDemoDriver.ts) | [`08-contact.md`](../../rules/08-contact.md) / [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) |
| [`src/ui/hooks/useDeckCount.ts`](../../../src/ui/hooks/useDeckCount.ts) | _(参照なし)_ |
| [`src/ui/hooks/useDeclareNamePicker.ts`](../../../src/ui/hooks/useDeclareNamePicker.ts) | [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/ui/hooks/useEffectPickFlowDriver.ts`](../../../src/ui/hooks/useEffectPickFlowDriver.ts) | _(参照なし)_ |
| [`src/ui/hooks/useEffectStack.ts`](../../../src/ui/hooks/useEffectStack.ts) | _(参照なし)_ |
| [`src/ui/hooks/useEngineDispatch.ts`](../../../src/ui/hooks/useEngineDispatch.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`11-reasoning.md`](../../rules/11-reasoning.md) / [`12-next-hint.md`](../../rules/12-next-hint.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |
| [`src/ui/hooks/useEngineDispatch/can-check.ts`](../../../src/ui/hooks/useEngineDispatch/can-check.ts) | _(参照なし)_ |
| [`src/ui/hooks/useEngineDispatch/set-card-boundary.ts`](../../../src/ui/hooks/useEngineDispatch/set-card-boundary.ts) | _(参照なし)_ |
| [`src/ui/hooks/useEngineDispatch/types.ts`](../../../src/ui/hooks/useEngineDispatch/types.ts) | _(参照なし)_ |
| [`src/ui/hooks/useEvidence.ts`](../../../src/ui/hooks/useEvidence.ts) | _(参照なし)_ |
| [`src/ui/hooks/useEvidenceFlipPicker.ts`](../../../src/ui/hooks/useEvidenceFlipPicker.ts) | [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) / [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) |
| [`src/ui/hooks/useFile.ts`](../../../src/ui/hooks/useFile.ts) | _(参照なし)_ |
| [`src/ui/hooks/useFlipAnimation.ts`](../../../src/ui/hooks/useFlipAnimation.ts) | _(参照なし)_ |
| [`src/ui/hooks/useHandCostPicker.ts`](../../../src/ui/hooks/useHandCostPicker.ts) | _(参照なし)_ |
| [`src/ui/hooks/useHiramekiDemoDriver.ts`](../../../src/ui/hooks/useHiramekiDemoDriver.ts) | _(参照なし)_ |
| [`src/ui/hooks/useHiramekiFlowDriver.ts`](../../../src/ui/hooks/useHiramekiFlowDriver.ts) | [`10-action-event.md`](../../rules/10-action-event.md) |
| [`src/ui/hooks/useLogEntries.ts`](../../../src/ui/hooks/useLogEntries.ts) | _(参照なし)_ |
| [`src/ui/hooks/useMatchModalLayer.ts`](../../../src/ui/hooks/useMatchModalLayer.ts) | _(参照なし)_ |
| [`src/ui/hooks/useMisreadFlowDriver.ts`](../../../src/ui/hooks/useMisreadFlowDriver.ts) | [`13-keywords.md`](../../rules/13-keywords.md) |
| [`src/ui/hooks/useModalFocusTrap.ts`](../../../src/ui/hooks/useModalFocusTrap.ts) | _(参照なし)_ |
| [`src/ui/hooks/useMulligan.ts`](../../../src/ui/hooks/useMulligan.ts) | [`26-05-11-ui-game-setup-flows.md`](../../rules/26-05-11-ui-game-setup-flows.md) |
| [`src/ui/hooks/useNextHintPicker.ts`](../../../src/ui/hooks/useNextHintPicker.ts) | [`12-next-hint.md`](../../rules/12-next-hint.md) |
| [`src/ui/hooks/useOppTurnDriver.ts`](../../../src/ui/hooks/useOppTurnDriver.ts) | [`26-05-11-ui-action-flows.md`](../../rules/26-05-11-ui-action-flows.md) |
| [`src/ui/hooks/usePartner.ts`](../../../src/ui/hooks/usePartner.ts) | [`06-card-types.md`](../../rules/06-card-types.md) / [`18-mr.md`](../../rules/18-mr.md) |
| [`src/ui/hooks/useRemoveCards.ts`](../../../src/ui/hooks/useRemoveCards.ts) | _(参照なし)_ |
| [`src/ui/hooks/useReplayDriver.ts`](../../../src/ui/hooks/useReplayDriver.ts) | _(参照なし)_ |
| [`src/ui/hooks/useSceneCharacters.ts`](../../../src/ui/hooks/useSceneCharacters.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) |
| [`src/ui/hooks/useSceneSwitchPickerStore.ts`](../../../src/ui/hooks/useSceneSwitchPickerStore.ts) | [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) |
| [`src/ui/hooks/useSetCardCostPicker.ts`](../../../src/ui/hooks/useSetCardCostPicker.ts) | _(参照なし)_ |
| [`src/ui/hooks/useSpectatorTurnDriver.ts`](../../../src/ui/hooks/useSpectatorTurnDriver.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) |
| [`src/ui/hooks/useStackedCardCostPicker.ts`](../../../src/ui/hooks/useStackedCardCostPicker.ts) | _(参照なし)_ |
| [`src/ui/hooks/useStageScale.ts`](../../../src/ui/hooks/useStageScale.ts) | _(参照なし)_ |
| [`src/ui/hooks/useTargetPicker.ts`](../../../src/ui/hooks/useTargetPicker.ts) | [`07-action-flow.md`](../../rules/07-action-flow.md) / [`11-reasoning.md`](../../rules/11-reasoning.md) / [`17-icons.md`](../../rules/17-icons.md) / [`26-05-11-ui-action-flows.md`](../../rules/26-05-11-ui-action-flows.md) |
| [`src/ui/hooks/useTopBar.ts`](../../../src/ui/hooks/useTopBar.ts) | _(参照なし)_ |
| [`src/ui/presentation/coordinator.ts`](../../../src/ui/presentation/coordinator.ts) | _(参照なし)_ |
| [`src/ui/presentation/normalizedLog.ts`](../../../src/ui/presentation/normalizedLog.ts) | _(参照なし)_ |
| [`src/ui/presentation/PresentationQueue.ts`](../../../src/ui/presentation/PresentationQueue.ts) | _(参照なし)_ |
| [`src/ui/presentation/store.ts`](../../../src/ui/presentation/store.ts) | _(参照なし)_ |
| [`src/ui/presentation/usePresentationQueue.ts`](../../../src/ui/presentation/usePresentationQueue.ts) | _(参照なし)_ |
| [`src/ui/services/actionLabel.ts`](../../../src/ui/services/actionLabel.ts) | _(参照なし)_ |
| [`src/ui/services/cardImage.ts`](../../../src/ui/services/cardImage.ts) | _(参照なし)_ |
| [`src/ui/services/cardResolvers.ts`](../../../src/ui/services/cardResolvers.ts) | _(参照なし)_ |
| [`src/ui/services/deckBuilder.ts`](../../../src/ui/services/deckBuilder.ts) | [`02-deck-construction.md`](../../rules/02-deck-construction.md) |
| [`src/ui/services/effectPickerVisibility.ts`](../../../src/ui/services/effectPickerVisibility.ts) | _(参照なし)_ |
| [`src/ui/services/gameStarter.ts`](../../../src/ui/services/gameStarter.ts) | [`04-game-setup.md`](../../rules/04-game-setup.md) |
| [`src/ui/services/handUseReason.ts`](../../../src/ui/services/handUseReason.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`12-next-hint.md`](../../rules/12-next-hint.md) / [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) |
| [`src/ui/services/hiramekiDemoSession.ts`](../../../src/ui/services/hiramekiDemoSession.ts) | _(参照なし)_ |
| [`src/ui/services/humanDecisionOwner.ts`](../../../src/ui/services/humanDecisionOwner.ts) | _(参照なし)_ |
| [`src/ui/services/liveReplayRecorder.ts`](../../../src/ui/services/liveReplayRecorder.ts) | _(参照なし)_ |
| [`src/ui/services/matchSession.ts`](../../../src/ui/services/matchSession.ts) | _(参照なし)_ |
| [`src/ui/services/matchSessionId.ts`](../../../src/ui/services/matchSessionId.ts) | _(参照なし)_ |
| [`src/ui/services/replayOwnership.ts`](../../../src/ui/services/replayOwnership.ts) | _(参照なし)_ |
| [`src/ui/services/replayStateBoundary.ts`](../../../src/ui/services/replayStateBoundary.ts) | _(参照なし)_ |
| [`src/ui/services/replayViewerProjection.ts`](../../../src/ui/services/replayViewerProjection.ts) | _(参照なし)_ |
| [`src/ui/services/scenePick.ts`](../../../src/ui/services/scenePick.ts) | [`03-field-areas.md`](../../rules/03-field-areas.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) / [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) |
| [`src/ui/services/storeTransaction.ts`](../../../src/ui/services/storeTransaction.ts) | _(参照なし)_ |
| [`src/ui/services/terminalInteractionCleanup.ts`](../../../src/ui/services/terminalInteractionCleanup.ts) | _(参照なし)_ |
| [`src/ui/services/terminalInteractionGate.ts`](../../../src/ui/services/terminalInteractionGate.ts) | _(参照なし)_ |
| [`src/ui/services/terminalInteractionPublication.ts`](../../../src/ui/services/terminalInteractionPublication.ts) | _(参照なし)_ |
| [`src/ui/services/tutorialSteps.ts`](../../../src/ui/services/tutorialSteps.ts) | [`01-curriculum-design.md`](../../rules/01-curriculum-design.md) |
| [`src/ui/services/uidNames.ts`](../../../src/ui/services/uidNames.ts) | _(参照なし)_ |
| [`src/ui/state/autonomousDecisionGate.ts`](../../../src/ui/state/autonomousDecisionGate.ts) | _(参照なし)_ |
| [`src/ui/state/interactionLock.ts`](../../../src/ui/state/interactionLock.ts) | [`05-turn-phases.md`](../../rules/05-turn-phases.md) / [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) |
| [`src/ui/state/store.ts`](../../../src/ui/state/store.ts) | _(参照なし)_ |
| [`src/ui/state/surface-pending.ts`](../../../src/ui/state/surface-pending.ts) | _(参照なし)_ |
| [`src/ui/state/tutorialStore.ts`](../../../src/ui/state/tutorialStore.ts) | _(参照なし)_ |
