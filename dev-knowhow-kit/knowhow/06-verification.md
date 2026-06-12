# 06. 実機検証の規律 — Playwright + decoy + 決定論 smoke

「型・テストが通る」と「実際に動く」の間にある溝を埋める検証体系。
BUG-117〜121（DSL に条件が書けても engine が評価していなかった）の教訓が中核。

## 大原則: 画面表示確認 ≠ 機能確認

- 静的スクリーンショットだけでは不十分。click → 処理解決 → state 反映までを実機で確認
- 機能変更を含む単位では **1 セッション通し検証**（開始 → 終了 or 上限ターンまで通し操作、
  各 step で console error 0 確認）
- **型/DSL に条件が書けていても実行系が評価する保証はない**。実機で必ず踏むこと

## decoy 検証（表示・処理 = 仕様文言の 1 対 1 突合）

仕様文言通りに動くかを検証するとき、**条件外の decoy（おとり）データを意図的に配置** する:

- 例: 「レベル 3 以下の青のキャラを選ぶ」→ レベル 4 の青・レベル 3 の赤を盤面に置き、
  候補に **出ないこと** を確認する
- 対象範囲 / filter 条件（数値・色・種別・状態）/ 枚数 / 選択者 / 持続 / 複数択 UI が
  仕様の語と 1 対 1 で一致することを確認
- 「候補が表示される」だけの確認では filter 不評価バグ（一番多い故障モード）を素通しする

## E2E ハーネス設計（tests/e2e/helpers/ パターン）

- **setup.ts**: page.goto 後にアプリが `window.__game` 等のテストフックを露出するのを
  waitForFunction で待機 + console error collector（favicon/404 はフィルタ除外し、
  それ以外の console.error を全件収集 → 「console error 0」検証を機械化）
- **state.ts**: `buildGameState(page, modifier)` — modifier 関数を `toString()` で文字列化し
  evaluate 内で `new Function` 再構築する **任意状態注入** パターン
  （制約も規約化: 外部スコープ参照不可・引数は JSON シリアライズ可能のみ）
- playwright.config.ts: workers:1 / fullyParallel:false / webServer 自動起動 / ローカル headed・CI headless
- 命名規約: **バグ 1 件 = 回帰 E2E 1 本**（bug-XXX.spec.ts）、共通パターン 1 つ = 1 spec（patterns/ 配下）

## 大量自動実行 smoke（決定論設計）

ランダム性のあるシステム（ゲーム・シミュレーション・並行処理）の回帰検知:

- 各実行の Math.random を `seed=smoke-${i}` 派生 RNG で上書きし、内部シャッフルまで再現可能化
- `--seed=smoke-42` で **失敗ケースの単一再現実行** ができる
- 上限（MAX_TURNS 等）の turn-cap でハング検知
- モジュールグローバル状態は `_resetXxx()` 系のテスト用リセットフックで実行間隔離
- 実行（→ JSON レポート）と判定（baseline 比較）は別スクリプト（→ knowhow/04）
- **AI/自動経路は UI モーダルを通らないため smoke でしか exercise されない** —
  UI テストと smoke は検出範囲が違う別物として両方持つ

## 多層テスト要求（チェックリスト spec 化）

反復作業（新機能追加・新エンドポイント）ごとに checklist spec を作り、各層を義務化:

1. 分岐マトリクス確認（種別 × 経路の全数）
2. 配線 grep 確認（定義しただけで配線忘れ = silent no-op が最頻パターン）
3. 単体テスト → 統合テスト → smoke 採用確認 → 実機 E2E
4. チェックリストには **動機となった実バグ番号を埋め込む**（項目の形骸化防止）

## 検証スナップショット記法（セッション間の回帰検知）

引き継ぎ記述には必ず数値スナップショットを定型で埋める:

```
full vitest 1893 pass / 0 fail / typecheck・lint clean / smoke:1000 exceptions=0 / commit <hash> / 未push 2件
```

次セッションが同じコマンドを流して照合すれば、環境差・取り込み忘れのドリフトを即検知できる。

## 移植手順

1. アプリに `window.__appTestHook` 相当のテスト用フックを用意（dev ビルドのみで可）
2. helpers/setup.ts（フック待機 + console collector）と state.ts（状態注入）を自アプリ向けに書く
3. 「バグ 1 件 = 回帰 E2E 1 本」命名規約を CLAUDE.md に明記
4. ランダム性があるなら seed 注入式 runner + baseline 判定を導入
5. decoy 検証を CLAUDE.md のセルフレビュー必須項目に入れる
