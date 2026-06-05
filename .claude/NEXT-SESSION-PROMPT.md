# 次セッション再開プロンプト (2026-06-05 夜時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

---

```
名探偵コナンTCG MVP の engine 拡張バッチを継続してください。

## 現在地

- リポジトリ: c:/Users/arumi/OneDrive/デスクトップ/conan
- 最新コミット: 90277818 feat(cards): charSetCard batch #2 — 6 枚
- ALL_CARDS: 904 枚 (前セッション 859 → +45 枚、本セッション中)
- vitest: 1773 pass · 1 skip (回帰 0、BUG-077 のみ pre-existing flaky)
- e2e: 13/13 pass (engine-extensions + reuse-cards + full-match-human-vs-cpu)
- pre-commit hook: 全 lint clean (SKIP 不要)

## 完了済 (本セッション 9 commit 累積、2026-06-05)

engine 拡張 step 1〜5b の **batch #2** 連続実装 + lint 整備 + smoke test:

### batch #2 累積 (engine 変更 0)
- leave:to-remove #2: 7 枚 (D03004/B04030/P/B04059/B08042/B09007/P)
- sceneToHand #2: 5 枚 (D09014/15/B06076/PR135/141)
- charModifyLevel #2: MR 4 枚 (B05066/P/B07093/P, a2-only partial)
- charSetCard #2: 6 枚 (B02020/P/B02030/B02046/P/B03061, partial-impl 含む)

### lint / test 整備
- lint:bug-frontmatter を prefix match 化 + BUG-115 commit hash 反映
- lint:side-channel に engine-internal queue allowlist 追加
- BUG-116 (declaredAbility cost silent skip) 修正案 A 実装 + unit test
- 1試合通し human vs CPU smoke spec を新規作成 (CLAUDE.md 6.3)

### engine 拡張 5 ステップ × batch #1+#2 累積 = 45 枚

| 拡張 | batch #1 | batch #2 | 合計 |
|------|---------|---------|------|
| #1 leave:to-remove | 10 | 7 | 17 |
| #2 charModifyLevel | 2 | 4 | 6 |
| #3 multi-target Pattern A | 1 | — | 1 |
| #4 sceneToHand | 2 | 5 | 7 |
| #5a deckRevealUntil maxN | 6 | — | 6 |
| #5b charSetCard | 2 | 6 | 8 |

## 推奨される次の動き

### 優先度 高 (engine 拡張 → 大量 unlock)
1. **continuous aura** (~13 枚解禁) — 他キャラ buff、AP/LP read 全体に波及 (高リスク)
2. **untargetable** (~6 枚) — 全ターゲット処理に波及 (高リスク)
3. **partner ability rewrite** (~10 枚) — パートナー能力上書き機構

### 優先度 中 (batch #3 拡充、engine 変更 0 で進められる)
4. **leave:to-remove 残**: replace-on-leave (B01092 etc.) は別 engine 拡張、それ以外の simple は
   batch #3 で 5〜10 枚追加可能
5. **bounce 残**: 単純 enter/declared 系は batch #3 でさらに追加可能
6. **level-modify 残**: B08048 アンドレ・キャメル等の triggered 系
7. **set-card 残**: B02040/P / B03032/P 等、PA短縮形でさらに 5〜8 枚

### 優先度 低 (技術負債)
8. **BUG-077 flaky timeout**: vitest 全 suite 実行時のみ timeout、isolated は pass
   (registerAll 初期化負荷？) — root cause 調査必要

## 重要な参照ファイル

- 拡張計画: `.claude/specs/engine-extension-plan.md`
- ゲート表: `.claude/specs/card-impl-engine-gates.md`
- DEFERRED 一覧: `.claude/specs/DEFERRED-INDEX.md`
- BUG 一覧: `.claude/bugs/index.base`
- 本セッション changelog: `.claude/changelog-entries/2026-06-05-03〜20`

## 注意事項

- pre-commit hook が SKIP 不要で clean に通過する状態を維持してください
- partial-impl パターンの header 注記 (a1 DEFERRED 理由) は次セッション以降の拡張時の
  guide になります。新規バッチでも同じ慣習で書いてください
- engine#2 (charModifyLevel) MR partner-area declaration の partial-impl は将来対応領域

最初に何をすべきかを宣言してから着手してください。
```
