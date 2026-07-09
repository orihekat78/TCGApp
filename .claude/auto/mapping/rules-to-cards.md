# 🤖 ルール → ソース マッピング

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `3770afc27269`

各公式ルールがどのソースファイルから参照されているか。未参照ルールは要確認。

**34/36** ルールが少なくとも1ファイルから参照されている。

## 参照あり

| ルール | 参照数 | 参照元 (抜粋) |
| ----- | ------ | ------------- |
| [`01-curriculum-design.md`](../../rules/01-curriculum-design.md) | 1 | `ui/services/tutorialSteps.ts` |
| [`01-victory-conditions.md`](../../rules/01-victory-conditions.md) | 105 | `ai/match.ts`, `ai/move-enumerator.ts`, `ai/policies/heuristic.ts` ほか 102 件 |
| [`02-deck-construction.md`](../../rules/02-deck-construction.md) | 13 | `cards/ct-d08/index.ts`, `cards/ct-d11/index.ts`, `cards/ct-p09/B09100.ts` ほか 10 件 |
| [`03-field-areas.md`](../../rules/03-field-areas.md) | 310 | `cards/ct-d01/D01008.ts`, `cards/ct-d01/D01012.ts`, `cards/ct-d03/D03002.ts` ほか 307 件 |
| [`04-game-setup.md`](../../rules/04-game-setup.md) | 11 | `ai/match.ts`, `cards/ct-d08/D08001.ts`, `cards/ct-d08/D08002.ts` ほか 8 件 |
| [`05-turn-phases.md`](../../rules/05-turn-phases.md) | 96 | `ai/match.ts`, `ai/move-enumerator.ts`, `ai/policies/random.ts` ほか 93 件 |
| [`06-card-types.md`](../../rules/06-card-types.md) | 43 | `cards/ct-d01/D01016.ts`, `cards/ct-d02/D02016.ts`, `cards/ct-d03/D03016.ts` ほか 40 件 |
| [`07-action-flow.md`](../../rules/07-action-flow.md) | 148 | `ai/action-resolution.ts`, `ai/move-enumerator.ts`, `ai/policies/heuristic.ts` ほか 145 件 |
| [`08-contact.md`](../../rules/08-contact.md) | 91 | `ai/action-resolution.ts`, `ai/policies/heuristic.ts`, `cards/_shared/contactTargetMatches.ts` ほか 88 件 |
| [`09-cutin-disguise.md`](../../rules/09-cutin-disguise.md) | 208 | `cards/_shared/contactTargetMatches.ts`, `cards/_shared/eventRemoveByAP.ts`, `cards/ct-d01/D01009.ts` ほか 205 件 |
| [`10-action-event.md`](../../rules/10-action-event.md) | 256 | `cards/ct-d01/D01003.ts`, `cards/ct-d01/D01006.ts`, `cards/ct-d01/D01012.ts` ほか 253 件 |
| [`11-reasoning.md`](../../rules/11-reasoning.md) | 65 | `ai/move-enumerator.ts`, `ai/policies/heuristic.ts`, `cards/ct-d01/D01010.ts` ほか 62 件 |
| [`12-next-hint.md`](../../rules/12-next-hint.md) | 21 | `ai/policies/heuristic.ts`, `cards/ct-p02/B02063.ts`, `cards/ct-p03/B03051.ts` ほか 18 件 |
| [`13-keywords.md`](../../rules/13-keywords.md) | 348 | `ai/move-enumerator.ts`, `ai/policies/heuristic.ts`, `ai/policy.ts` ほか 345 件 |
| [`14-refresh.md`](../../rules/14-refresh.md) | 303 | `cards/ct-d01/D01003.ts`, `cards/ct-d01/D01006.ts`, `cards/ct-d01/D01012.ts` ほか 300 件 |
| [`15-abilities-effects.md`](../../rules/15-abilities-effects.md) | 1025 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/caseResolvedHandRemove.ts`, `cards/_shared/eventRemoveByAP.ts` ほか 1022 件 |
| [`15-contact-removal-observer-design.md`](../../rules/15-contact-removal-observer-design.md) | 4 | `cards/ct-d10/D10007.ts`, `cards/ct-d10/D10008.ts`, `cards/ct-p01/B01007.ts`, `cards/ct-p09/B09026.ts` |
| [`15-workflow.md`](../../rules/15-workflow.md) | 2 | `cards/ct-d08/D08015.ts`, `cards/ct-d08/D08016.ts` |
| [`16-card-set.md`](../../rules/16-card-set.md) | 64 | `cards/ct-d08/D08021.ts`, `cards/ct-d10/D10024.ts`, `cards/ct-p01/B01023.ts` ほか 61 件 |
| [`17-icons.md`](../../rules/17-icons.md) | 1028 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/caseMonoColor.ts`, `cards/_shared/caseTraitConditioned.ts` ほか 1025 件 |
| [`18-mr.md`](../../rules/18-mr.md) | 17 | `cards/ct-p05/B05045.ts`, `cards/ct-p05/B05066.ts`, `cards/ct-p06/B06085.ts` ほか 14 件 |
| [`19-special-rules.md`](../../rules/19-special-rules.md) | 267 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/_shared/eventRemoveByAP.ts`, `cards/ct-d01/D01003.ts` ほか 264 件 |
| [`20-color-and-switch.md`](../../rules/20-color-and-switch.md) | 230 | `cards/_shared/caseMonoColor.ts`, `cards/ct-d01/D01004.ts`, `cards/ct-d01/D01008.ts` ほか 227 件 |
| [`21-declared-ability-cost.md`](../../rules/21-declared-ability-cost.md) | 295 | `ai/ability-ctx.ts`, `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/ct-d01/D01003.ts` ほか 292 件 |
| [`22-qa-action-contact.md`](../../rules/22-qa-action-contact.md) | 252 | `cards/_shared/contactTargetMatches.ts`, `cards/ct-d01/D01009.ts`, `cards/ct-d01/D01010.ts` ほか 249 件 |
| [`23-qa-disguise-cutin.md`](../../rules/23-qa-disguise-cutin.md) | 39 | `cards/ct-d11/D11013.ts`, `cards/ct-d11/D11017.ts`, `cards/ct-d11/D11018.ts` ほか 36 件 |
| [`24-qa-naming-stun.md`](../../rules/24-qa-naming-stun.md) | 149 | `cards/_shared/partnerColorFilteredAssault.ts`, `cards/_shared/partnerColorKeyword.ts`, `cards/ct-d01/D01005.ts` ほか 146 件 |
| [`25-qa-effects-resolution.md`](../../rules/25-qa-effects-resolution.md) | 30 | `cards/_shared/caseResolvedHandRemove.ts`, `cards/ct-d08/D08005.ts`, `cards/ct-d08/D08006.ts` ほか 27 件 |
| [`26-05-11-ui-action-flows.md`](../../rules/26-05-11-ui-action-flows.md) | 4 | `ui/hooks/useActionsPanelFlow.ts`, `ui/hooks/useConfirmation.ts`, `ui/hooks/useOppTurnDriver.ts`, `ui/hooks/useTargetPicker.ts` |
| [`26-05-11-ui-game-setup-flows.md`](../../rules/26-05-11-ui-game-setup-flows.md) | 1 | `ui/hooks/useMulligan.ts` |
| [`26-07-02.md`](../../rules/26-07-02.md) | 1 | `engine/read/scene-cap.ts` |
| [`26-qa-deck-refresh.md`](../../rules/26-qa-deck-refresh.md) | 191 | `cards/_shared/caseDeclaredEvidenceFlip.ts`, `cards/ct-d01/D01012.ts`, `cards/ct-d01/D01013.ts` ほか 188 件 |
| [`27-card-restrictions.md`](../../rules/27-card-restrictions.md) | 1 | `cards/ct-p01/B01058.ts` |
| [`28-errata.md`](../../rules/28-errata.md) | 2 | `cards/ct-p01/B01094.ts`, `cards/ct-p01/B01094P.ts` |

## 参照なし (要確認)

以下のルールはコード側から `// rules:` コメントで参照されていない。
実装上参照すべきだが漏れているか、純粋に対戦運用ルール（フロアルール等）でコード非該当の可能性あり。

- [`29-floor-rule-timing.md`](../../rules/29-floor-rule-timing.md)
- [`30-floor-rule-misplay.md`](../../rules/30-floor-rule-misplay.md)

---

## ソース

- [`.claude/rules/`](../../rules/)
- [`src/`](../../../src/)
