## BUG-121 残課題の全解消 + text-faithfulness 検査の規約化 + 教訓更新運用の明文化

**Round/Phase**: 2026-06-06 session — user 指示「残課題は残さず全て解消」「Playwright 画面処理=テキスト文言 検査を項目化」+ 質問「教訓ファイルは自動更新されるか」への対応

### 残課題の全解消

- **BUG-121 sequence 内 choice (汎用化)**: 当初 top-level (B06007) のみ対応で sequence 内 human 複数択
  choice は scope 外としていたのを汎用解消。engine holder `__pendingEffectChoiceResume` を新設し、
  resolve-picks の sequence case が choice pause を検知したら remainder を `{sequence:[choice, ...remainder]}`
  に wrap (任意深度のネスト対応)、`applyChoiceAndContinuation` を holder ベースに変更。初回 runtime は
  pre-choice step のみ実行 → choiceResolve で option + remainder のみ実行 (pre-choice 二重実行なし)。
  検証: `tests/engine/effect/bug-121-sequence-choice.test.ts` (hand=13/11)。top-level 挙動は不変。
- **bug-077 flaky timeout 解消**: `vitest.config.ts` に `testTimeout: 20000` / `hookTimeout: 30000`。
  本環境 (OneDrive 同期パス・933 カード) で `await import('@/cards/index')` が 5s 既定を超過する
  環境依存 flaky をテストロジック不変で吸収 (真の hang は 20s 超で検出可能)。全 vitest 1788 pass / 0 fail。
- **監査 suspect の検証完了**: B08042/B04030/B03013 の leave→pick 候補フィルタを
  `tests/engine/effect/audit-leave-suspects.test.ts` で決定論的に検証 (sleep/levelMax:8/side:either)。
  leave→pick の UI フロー自体は B03091 Playwright で実証済。全 6 suspect 検証完了。

### 規約・教訓の更新

- **card-addition-checklist §7 / CLAUDE.md §セルフレビュー** に「**Playwright で画面処理 = カードテキスト文言**
  を実機検証」項目を追加 (対象範囲/filter条件/枚数/選択者/持続/複数択 modal を decoy で 1 対 1 突合)。
- **LESSONS-LEARNED-3.md** を新設 (教訓 23 型に field 在る≠評価する / 24 turnEffects key 追加時 clearTurnEffects
  対称更新 / 25 選択者と対象側の混同回避・複数択 surface)。さらに「**教訓ファイルは自動更新されない**
  (hook 無し)。バグ修正時に BUG-XXX.md、同種2件 or session 完了時に LESSONS-LEARNED-N.md を手動更新し
  月次 audit 待ちにしない」運用を明文化 (user 質問への回答)。

### 検証

- typecheck clean / 全 vitest **1788 pass / 0 fail** (bug-077 flaky 解消) / 全 e2e **96 pass** /
  lint (side-channel errors=0: EffectChoiceResume を engine-internal allowlist 追加 / listener / bugs) errors=0。
