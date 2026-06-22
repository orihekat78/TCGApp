# Phase 3b 回帰テスト棚卸し: BUG-054〜121 を責務 3 group へ

pick-resolution に蓄積した BUG パッチ (15+) を **walk / pending / continuation** の 3 責務に分類し、
分割後も各モジュールの挙動が既存テストで回帰固定されていることを示す (テストファイルは移動しない。
本表は coverage map = 棚卸しであり、分割の安全性根拠)。各 BUG の根拠コードは design の責務行に対応。

## group A — walk (resolveEffectPicks / substituteAtomPick / tryRePickFromAtom / dyn)

`$pick` 置換・短縮形展開・dyn 解決・Pattern A/B・候補列挙・choice/optional surface 判定。

| BUG | 内容 | 主テスト |
|---|---|---|
| 035 | pick substitution 基盤 | resolve-picks.test.ts |
| 054/065 | Pattern A (uid=$pick) / Pattern B (target) 区別 | pattern-b-cards.test.ts / multi-target-pick.test.ts |
| 075/076/077 | 複数 PB の上書き回避 / evidence 候補 / runtime 遅延 set | bug-077-evidence-to-hand-e2e.test.ts / pattern-b-cards.test.ts |
| 083 | multi-entry switch の pick | bug-083-multi-entry-switch.test.ts |
| 085 | `{dyn}` args の literal 化 (resolveDynArgs) | short-form-characterization.test.ts |
| 103/106 | cardIds[] / cardId 単一 contract (AI 経路解決) | multi-target-pick / D11014.a2-ai-reanimate.test.ts |
| 108 | choice index unwrap (ctx.dyn) | bug-108-choice-index.test.ts / bug-108-choice-picker.test.ts |
| 121(walk) | sequence/choice surface・holder wrap | bug-121-sequence-choice.test.ts |
| cluster12 | nested-filter-dyn (resolveTargetFilterDyn) | cluster12-nested-filter-dyn.test.ts |
| 短縮形 | buildShortFormPick 既定 area/side | short-form-new-verbs.test.ts / atom-target-normalize.test.ts |

## group B — pending管理 (side-channel queue/slot/holder state)

push/drain/peek/clear・FIFO 順・legacy property 同期・toPlainDeep (proxy safety)・所有権 filter。

| BUG | 内容 | 主テスト |
|---|---|---|
| 078 | 単一スロット → FIFO queue 化 | resolve-picks.test.ts / multi-target-pick.test.ts |
| 114 | choice surface 時 bindings holder 保持 | bug-114-discard-bind-dyn.test.ts |
| 132 | toPlainDeep で draft proxy 越境回避 / skipResolvesAtom flag | bug-132-gap-fixes.test.ts |
| 134 | cofire 時 pick queue の staleness | bug-134-cofire-pick-staleness.test.ts |
| 138 | drain 所有権 (__humanPlayerSide で human pending を温存) | bug-138-drain-ownership.test.ts |

## group C — continuation (apply-pick: resume + drain、resolver: attach)

applyPickAndContinuation / runContinuationChain / drainAiEffectPicks / attachContinuation。
remainder 実行・BUG-107 bind 共有・BUG-111 nest・decline/skip 分岐。

| BUG | 内容 | 主テスト |
|---|---|---|
| 105/107 | sequence pick await の remainder を同一 ctx で実行 (bind 共有) | bug-107-d11014-bind-propagation.test.ts |
| 109 | AI 経路 PA 短縮形 pick の drain | bug-109-ai-pa-drain.test.ts |
| 111 #1/#2/family | continuation-nest / decline origin (sequence vs chain gate) | bug-111-continuation-nest / -human-decline-repro / -pick-continuation-pairing / continuation-nest-b06033.test.ts |
| 121(resume) | applyChoiceAndContinuation で option 再開 | bug-121-sequence-choice.test.ts / useOppTurnDriver.case-resolved-pick.test.ts |
| 132 GAP-1 | applyPickSkipAndContinuation (0枚 decline の remainder 続行) | bug-132-gap-fixes.test.ts |
| 135 | sequence 非終端の skippable pick を decline → 後続必須 remainder 実行 (実出荷 PR155/D03002) | bug-135-sequence-middle-skip.test.ts |
| taskC | applyOptionalAndContinuation (optional 再開) | optional-decision-batch.test.ts |
| cluster14 | multi-sceneenter switchRemoveUids[] | cluster14-multi-sceneenter.test.ts |

## 横断 (smoke / e2e)

- smoke:1000 baseline (winsA exact) — 全 group の統合挙動 (AI drain 経路含む)。
- e2e 3 spec (engine-extensions / reuse-cards / task-d-extensions) — human pick modal 経路。

## 結論

3 group いずれも分割後も同一テストが網羅 (テスト import は resolve-picks/apply-pick 再export 経由で不変)。
pending管理を pending-state.ts に集約することで group B の side-channel が単一モジュールに収束し、
Phase 3c (side-channel 8→5 縮減) の前提が整う。
