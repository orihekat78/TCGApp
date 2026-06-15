# 🤖 ルール → ソース マッピング

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `9a8689ffd407`

各公式ルールがどのソースファイルから参照されているか。未参照ルールは要確認。

**31/34** ルールが少なくとも1ファイルから参照されている。

## 参照あり

| ルール | 参照数 | 参照元 (抜粋) |
| ----- | ------ | ------------- |
| [`01-curriculum-design.md`](../../rules/01-curriculum-design.md) | 1 | `ui/services/tutorialSteps.ts` |
| [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) | 82 | `ai/match.ts`, `ai/move-enumerator.ts`, `ai/policies/heuristic.ts` ほか 79 件 |
| [`02-deck-construction.md`](../../rules/02-deck-construction.md) | 11 | `cards/ct-d08/index.ts`, `cards/ct-d11/index.ts`, `cards/ct-p09/B09100.ts` ほか 8 件 |
| [`03-field-areas.md`](../../rules/03-field-areas.md) | 156 | `cards/ct-d01/D01012.ts`, `cards/ct-d03/D03002.ts`, `cards/ct-d03/D03011.ts` ほか 153 件 |
| [`04-game-setup.md`](../../rules/04-game-setup.md) | 11 | `ai/match.ts`, `cards/ct-d08/D08001.ts`, `cards/ct-d08/D08002.ts` ほか 8 件 |
| [`05-turn-phases.md`](../../rules/05-turn-phases.md) | 57 | `ai/match.ts`, `ai/move-enumerator.ts`, `ai/policies/random.ts` ほか 54 件 |
| [`06-card-types.md`](../../rules/06-card-types.md) | 36 | `cards/ct-d01/D01016.ts`, `cards/ct-d02/D02016.ts`, `cards/ct-d03/D03016.ts` ほか 33 件 |
| [`07-action-flow.md`](../../rules/07-action-flow.md) | 69 | `ai/action-resolution.ts`, `ai/move-enumerator.ts`, `ai/policies/heuristic.ts` ほか 66 件 |
| [`08-contact.md`](../../rules/08-contact.md) | 31 | `ai/action-resolution.ts`, `ai/policies/heuristic.ts`, `cards/_shared/contactTargetMatches.ts` ほか 28 件 |
| [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) | 165 | `cards/_shared/contactTargetMatches.ts`, `cards/_shared/eventRemoveByAP.ts`, `cards/ct-d01/D01009.ts` ほか 162 件 |
| [`10-action-event.md`](../../rules/10-action-event.md) | 137 | `cards/ct-d01/D01003.ts`, `cards/ct-d01/D01006.ts`, `cards/ct-d01/D01012.ts` ほか 134 件 |
| [`11-reasoning.md`](../../rules/11-reasoning.md) | 45 | `ai/move-enumerator.ts`, `ai/policies/heuristic.ts`, `cards/ct-d01/D01010.ts` ほか 42 件 |
| [`12-next-hint.md`](../../rules/12-next-hint.md) | 14 | `ai/policies/heuristic.ts`, `cards/ct-p02/B02063.ts`, `cards/ct-p05/B05037.ts` ほか 11 件 |
| [`13-keywords.md`](../../rules/13-keywords.md) | 203 | `ai/move-enumerator.ts`, `ai/policies/heuristic.ts`, `ai/policy.ts` ほか 200 件 |
| [`14-refresh.md`](../../rules/14-refresh.md) | 142 | `cards/ct-d01/D01003.ts`, `cards/ct-d01/D01006.ts`, `cards/ct-d01/D01012.ts` ほか 139 件 |
| [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) | 593 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/caseResolvedHandRemove.ts`, `cards/_shared/eventRemoveByAP.ts` ほか 590 件 |
| [`15-workflow.md`](../../rules/15-workflow.md) | 2 | `cards/ct-d08/D08015.ts`, `cards/ct-d08/D08016.ts` |
| [`16-card-set.md`](../../rules/16-card-set.md) | 28 | `cards/ct-d08/D08021.ts`, `cards/ct-p02/B02020.ts`, `cards/ct-p02/B02023.ts` ほか 25 件 |
| [`17-icons.md`](../../rules/17-icons.md) | 597 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/caseMonoColor.ts`, `cards/_shared/caseTraitConditioned.ts` ほか 594 件 |
| [`18-mr.md`](../../rules/18-mr.md) | 11 | `cards/ct-p05/B05066.ts`, `cards/ct-p07/B07079.ts`, `cards/ct-p07/B07079P.ts` ほか 8 件 |
| [`19-special-rules.md`](../../rules/19-special-rules.md) | 143 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/eventRemoveByAP.ts`, `cards/ct-d01/D01003.ts` ほか 140 件 |
| [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) | 102 | `cards/_shared/caseMonoColor.ts`, `cards/ct-d01/D01004.ts`, `cards/ct-d01/D01015.ts` ほか 99 件 |
| [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) | 179 | `ai/ability-ctx.ts`, `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/ct-d01/D01003.ts` ほか 176 件 |
| [`22-qa-action-contact.md`](../../rules/22-qa-action-contact.md) | 168 | `cards/_shared/contactTargetMatches.ts`, `cards/ct-d01/D01009.ts`, `cards/ct-d01/D01010.ts` ほか 165 件 |
| [`23-qa-disguise-cutin.md`](../../rules/23-qa-disguise-cutin.md) | 18 | `cards/ct-d11/D11013.ts`, `cards/ct-d11/D11017.ts`, `cards/ct-d11/D11018.ts` ほか 15 件 |
| [`24-qa-naming-stun.md`](../../rules/24-qa-naming-stun.md) | 76 | `cards/_shared/partnerColorKeyword.ts`, `cards/ct-d01/D01005.ts`, `cards/ct-d02/D02003.ts` ほか 73 件 |
| [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) | 14 | `cards/_shared/caseResolvedHandRemove.ts`, `cards/ct-d08/D08005.ts`, `cards/ct-d08/D08006.ts` ほか 11 件 |
| [`26-05-11-ui-action-flows.md`](../../rules/26-05-11-ui-action-flows.md) | 4 | `ui/hooks/useActionsPanelFlow.ts`, `ui/hooks/useConfirmation.ts`, `ui/hooks/useOppTurnDriver.ts`, `ui/hooks/useTargetPicker.ts` |
| [`26-05-11-ui-game-setup-flows.md`](../../rules/26-05-11-ui-game-setup-flows.md) | 1 | `ui/hooks/useMulligan.ts` |
| [`26-qa-deck-refresh.md`](../../rules/26-qa-deck-refresh.md) | 72 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/ct-d01/D01012.ts`, `cards/ct-d01/D01013.ts` ほか 69 件 |
| [`28-errata.md`](../../rules/28-errata.md) | 2 | `cards/ct-p01/B01094.ts`, `cards/ct-p01/B01094P.ts` |

## 参照なし (要確認)

以下のルールはコード側から `// rules:` コメントで参照されていない。
実装上参照すべきだが漏れているか、純粋に対戦運用ルール（フロアルール等）でコード非該当の可能性あり。

- [`27-card-restrictions.md`](../../rules/27-card-restrictions.md)
- [`29-floor-rule-timing.md`](../../rules/29-floor-rule-timing.md)
- [`30-floor-rule-misplay.md`](../../rules/30-floor-rule-misplay.md)

---

## ソース

- [`.claude/rules/`](../../rules/)
- [`src/`](../../../src/)
