# 🤖 ルール → ソース マッピング

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `3a213cd0c95d`

各公式ルールがどのソースファイルから参照されているか。未参照ルールは要確認。

**30/34** ルールが少なくとも1ファイルから参照されている。

## 参照あり

| ルール | 参照数 | 参照元 (抜粋) |
| ----- | ------ | ------------- |
| [`01-curriculum-design.md`](../../rules/01-curriculum-design.md) | 1 | `ui/services/tutorialSteps.ts` |
| [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) | 21 | `ai/match.ts`, `ai/move-enumerator.ts`, `ai/policies/heuristic.ts` ほか 18 件 |
| [`02-deck-construction.md`](../../rules/02-deck-construction.md) | 10 | `cards/ct-d08/index.ts`, `cards/ct-d11/index.ts`, `cards/index.ts` ほか 7 件 |
| [`03-field-areas.md`](../../rules/03-field-areas.md) | 21 | `cards/_shared/hiramekiCharStun.ts`, `cards/ct-d08/D08019.ts`, `cards/ct-d08/D08020.ts` ほか 18 件 |
| [`04-game-setup.md`](../../rules/04-game-setup.md) | 11 | `ai/match.ts`, `cards/ct-d08/D08001.ts`, `cards/ct-d08/D08002.ts` ほか 8 件 |
| [`05-turn-phases.md`](../../rules/05-turn-phases.md) | 20 | `ai/match.ts`, `ai/move-enumerator.ts`, `ai/policies/random.ts` ほか 17 件 |
| [`06-card-types.md`](../../rules/06-card-types.md) | 10 | `engine/cards/registry.ts`, `engine/cards/tsv-loader-fs.ts`, `engine/cards/tsv-loader.ts` ほか 7 件 |
| [`07-action-flow.md`](../../rules/07-action-flow.md) | 20 | `ai/action-resolution.ts`, `ai/move-enumerator.ts`, `ai/policies/heuristic.ts` ほか 17 件 |
| [`08-contact.md`](../../rules/08-contact.md) | 15 | `ai/action-resolution.ts`, `ai/policies/heuristic.ts`, `cards/ct-d11/D11007.ts` ほか 12 件 |
| [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) | 20 | `cards/_shared/cutinFixedAP.ts`, `cards/_shared/eventRemoveByAP.ts`, `cards/ct-d08/D08007.ts` ほか 17 件 |
| [`10-action-event.md`](../../rules/10-action-event.md) | 16 | `cards/_shared/hiramekiCharStun.ts`, `cards/_shared/hiramekiDraw.ts`, `cards/ct-d08/D08013.ts` ほか 13 件 |
| [`11-reasoning.md`](../../rules/11-reasoning.md) | 9 | `ai/move-enumerator.ts`, `ai/policies/heuristic.ts`, `engine/mutate/evidence.ts` ほか 6 件 |
| [`12-next-hint.md`](../../rules/12-next-hint.md) | 8 | `ai/policies/heuristic.ts`, `engine/flow/main/hand-use-card.ts`, `engine/mutate/file.ts` ほか 5 件 |
| [`13-keywords.md`](../../rules/13-keywords.md) | 48 | `ai/move-enumerator.ts`, `ai/policies/heuristic.ts`, `ai/policy.ts` ほか 45 件 |
| [`14-refresh.md`](../../rules/14-refresh.md) | 15 | `cards/_shared/hiramekiDraw.ts`, `cards/ct-d08/D08013.ts`, `cards/ct-d08/D08014.ts` ほか 12 件 |
| [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) | 50 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/caseResolvedHandRemove.ts`, `cards/_shared/eventRemoveByAP.ts` ほか 47 件 |
| [`15-workflow.md`](../../rules/15-workflow.md) | 2 | `cards/ct-d08/D08015.ts`, `cards/ct-d08/D08016.ts` |
| [`16-card-set.md`](../../rules/16-card-set.md) | 2 | `cards/ct-d08/D08021.ts`, `engine/mutate/scene.ts` |
| [`17-icons.md`](../../rules/17-icons.md) | 48 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/caseTraitConditioned.ts`, `cards/_shared/eventRemoveByAP.ts` ほか 45 件 |
| [`18-mr.md`](../../rules/18-mr.md) | 3 | `engine/cond/eval.ts`, `engine/mutate/partner.ts`, `ui/hooks/usePartner.ts` |
| [`19-special-rules.md`](../../rules/19-special-rules.md) | 17 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/eventRemoveByAP.ts`, `cards/ct-d08/D08025.ts` ほか 14 件 |
| [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) | 11 | `cards/ct-d08/D08024.ts`, `cards/ct-d08/D08025.ts`, `cards/ct-d11/D11019.ts` ほか 8 件 |
| [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) | 21 | `ai/ability-ctx.ts`, `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/ct-d08/D08005.ts` ほか 18 件 |
| [`22-qa-action-contact.md`](../../rules/22-qa-action-contact.md) | 17 | `cards/_shared/cutinFixedAP.ts`, `cards/ct-d08/D08007.ts`, `cards/ct-d08/D08008.ts` ほか 14 件 |
| [`23-qa-disguise-cutin.md`](../../rules/23-qa-disguise-cutin.md) | 6 | `cards/_shared/cutinFixedAP.ts`, `cards/ct-d11/D11013.ts`, `cards/ct-d11/D11017.ts` ほか 3 件 |
| [`24-qa-naming-stun.md`](../../rules/24-qa-naming-stun.md) | 13 | `cards/_shared/hiramekiCharStun.ts`, `cards/_shared/partnerColorKeyword.ts`, `cards/ct-d08/D08009.ts` ほか 10 件 |
| [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) | 9 | `cards/_shared/caseResolvedHandRemove.ts`, `cards/ct-d08/D08005.ts`, `cards/ct-d08/D08006.ts` ほか 6 件 |
| [`26-05-11-ui-action-flows.md`](../../rules/26-05-11-ui-action-flows.md) | 4 | `ui/hooks/useActionsPanelFlow.ts`, `ui/hooks/useConfirmation.ts`, `ui/hooks/useOppTurnDriver.ts`, `ui/hooks/useTargetPicker.ts` |
| [`26-05-11-ui-game-setup-flows.md`](../../rules/26-05-11-ui-game-setup-flows.md) | 1 | `ui/hooks/useMulligan.ts` |
| [`26-qa-deck-refresh.md`](../../rules/26-qa-deck-refresh.md) | 8 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/ct-d08/D08026.ts`, `cards/ct-d11/D11019.ts` ほか 5 件 |

## 参照なし (要確認)

以下のルールはコード側から `// rules:` コメントで参照されていない。
実装上参照すべきだが漏れているか、純粋に対戦運用ルール（フロアルール等）でコード非該当の可能性あり。

- [`27-card-restrictions.md`](../../rules/27-card-restrictions.md)
- [`28-errata.md`](../../rules/28-errata.md)
- [`29-floor-rule-timing.md`](../../rules/29-floor-rule-timing.md)
- [`30-floor-rule-misplay.md`](../../rules/30-floor-rule-misplay.md)

---

## ソース

- [`.claude/rules/`](../../rules/)
- [`src/`](../../../src/)
