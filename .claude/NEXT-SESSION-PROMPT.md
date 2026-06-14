# 次セッション再開プロンプト (2026-06-15 BUG-143/144 + reanimate確認 + cluster8 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (certify / 意味等価突合 / 敵対設計レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠ **未 push (要ユーザー手動 push)**: 本セッションは「push せず local のみ」指示で進行。main は origin より
> **5 commit 先行** (`9911afe9` BUG-143 / `19cdaa23` BUG-144 / `399e553d` reanimate確認+BUG-145 /
> `764be98d` cluster8 / `521b7646` BUG-144 follow-up)。次セッション開始時に `git log origin/main..main` で
> 未 push を確認し、ユーザーに push 可否を確認すること (`git push origin main` → CI green 確認)。push 後にこの警告は削除。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15)

- engine拡張 wave#2 cluster1〜6 + cluster8 ✅ + cluster7 (engine変更0) ✅。ALL_CARDS = 1166。
- 本セッション (local 5 commit、未 push):
  - BUG-143 (contact-scope cleanup) / BUG-144 (AI case-action guard 窓 + smoke re-baseline winsA 469→498) /
    BUG-144 follow-up (bundled actionAgainstCase を passGuard に revert、hirameki demo/e2e 回帰修正)。
  - reanimate 族 B06052/D05006/PR138 は前 batch で実装済と判明 (certify queue 254/254 完走)。
    PR138 = certify false-green (a2 self-sleep が already-sleep 時 qAndA違反) → BUG-145 起票 + DEFER。
  - cluster8 ヒラメキ抑止窓: B06049 解禁。新機構 = setHiramekiSuppress verb + TurnScopedFlags.hiramekiSuppressed
    + handleEvidenceRemovedHook 抑止 + action-end 清掃。
- 全 gate green: full vitest 2113 / smoke:1000 baseline (winsA=498/avg=11.0、exceptions=0) / playwright 119。

## 次にやること (候補、未確定 — ユーザーと相談 or triage から選定)

DEFERRED-INDEX の残 engine-gate クラスタ (いずれも新 engine 機構 → /card-wave 設計ゲートを先に通す):
- **BUG-145 (PR138 fix)**: self-state condition (charStateIs{ref,state}) 追加 = 最小の独立 micro-cluster。
  追加すれば PR138 の登場時 self-sleep optional を gate でき、cluster3 DEFER 群の self-state 系も解禁余地。
- B07005 action-restriction「アクションできない」(self 行動禁止 + コンタクト中カットイン禁止、2 gate)。
- observer contact-removal attribution (D02008 a2 / B05066、byUid 帰属トリガ)。
- ヒラメキ抑止は cluster8 で実装済 (B06049)。B06035/B05039 (hirameki/cutin の contact-char trait gate) は別系。
- B08078 外部 hook 発火 (最難、cluster2 DEFER)。
- または taskA queue は 254/254 完走済 → needsManual 5件 (B06101/B07052/B08020系/D10011 等、closure 要) の手実装。

## プロセス必須
- /card-wave skill。green候補は未certify なら信用しない。**certify green でも意味等価は自前で1対1突合** (PR138 教訓)。
- 新 engine 機構は **playwright まで回す** (BUG-144 の bundled-path 過剰拡張は vitest/smoke 通過し playwright で初検出)。
- 新挙動は専用 vitest で実証 (制御 case 込)。heavy gates (full vitest/smoke:1000/playwright) はフェーズ終端。

## 状態 doc
- bug: .claude/bugs/index.base (BUG-143/144 修正済、BUG-145 未着手) / defer: .claude/specs/DEFERRED-INDEX.md
- 設計: cluster8 = B06049.ts コメント + changelog-entries/2026-06-15-02 / 敵対設計レビュー記録は session 内
```

本セッションは BUG-143/144 + reanimate確認 + cluster8 完了 (local 5 commit、全 gate green、未 push)。
次セッションは未 push 確認 → 次クラスタ選定から。
