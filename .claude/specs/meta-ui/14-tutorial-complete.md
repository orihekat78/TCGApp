# 14 — Phase 15: チュートリアル完成 (8 章 + 進捗 persist + 練習試合連携)

## 背景

Phase 13-F で骨格、Phase 14-D で練習試合連携を作ったが、章 4 のみ Illustration / step state ハードコード / persist なしという未完成状態。ユーザー指示「チュートリアルを完成させたい」を **標準スコープ (動的 unlock 除外)** で実装。

公式 https://www.takaratomy.co.jp/products/conan-cardgame/beginner/ + https://conan-tcg.commmune.com/ ルールマニュアル全 27 ページ を Playwright で参照し、章構成と Illustration デザインに反映。

## 章構成 (8 章、rules/01〜26 網羅)

| 新 | 章タイトル | 主な内容 + rules |
|---|---|---|
| 1 | 基本ルール | デッキ構築 (02) + 場のエリア (03) + 状態 3 種 (03) |
| 2 | カードの読み方 🆕 | キャラ / イベント / 事件 / パートナー の記載解説 (06) — `CardAnnotated` 新規 |
| 3 | ゲーム開始からターン進行 | マリガン (04) + 3 フェイズ (05) |
| 4 | キャラ行動とリソース管理 | 推理 + LP≤0 (11) / アクション (07) / コンタクト (08) / ネクストヒント (12) / リフレッシュ + 敗北 (14) |
| 5 | 解決編 + アシスト勝利不可 | 必要証拠 7/6 / 一方通行 / ⚠ 同ターン不可 (01) ← 練習試合 |
| 6 | 効果と能力 | アイコン (09, 10, 13) + 宣言能力 + コスト (21) + タイミング (17) + 解決順 (15, 25) |
| 7 | キーワード能力 🆕 | 疾風 / 突撃 / 迅速 / ブレット / 捜査 / 痕跡 (13, 22-26) — `KeywordCard` 新規 |
| 8 | 上級者向け | MR (18) + 色制限 + スイッチ (20) + スタン特殊 (03) + 数値修正 (19) + セット (16) |

`rules/27-30` (制限/エラッタ/フロアルール) は競技規定のため対象外。

## 主要変更 (`meta-app/` のみ)

### A. metaStore 拡張
- `Settings.tutorialClearedStepIds: string[]` + persist + hydrate fallback
- `_pendingPracticeChapter: number | null` (transient)
- actions: `markStepCleared` / `markChapterStepsCleared` / `isStepCleared` / `startPracticeFor` / `consumePendingPractice`

### B. TutorialScreen progress-driven
- 8 章 (beginner 4 + advanced 4) + 各章 4-6 steps、固定 stepId (`ch1-1` 等)
- state 算出: `cleared` / `current` (章内最初の未 clear) / `pending`
- 動的 unlock 削除 — **全章常時アクセス可能** (locked 状態は廃止、開発中のため)
- ChapterList を 2 グループラベル付きに (「初めての方は」「詳しく知りたい方」)
- step クリック → `markStepCleared` → persist

### C. 全 8 章 Illustration (`screens/tutorial/illustrations.tsx` 一括)
- 共通プリミティブ: `Panel` / `SectionLabel` / `TermRow` / `PointBox` / `WarnBox`
- ch1: 7 エリア構造 (相手陣 / 自陣 鏡像)
- ch2: `CardAnnotated` (公式 P3-5 参考、CalloutPill で番号注釈、4 種カード)
- ch3: 6 ステップ開幕シーケンス + 3 フェイズ flow
- ch4: 推理 vs アクション + コンタクト AP 比較 + NH + リフレッシュ + 敗北 WARN
- ch5: 事件編→解決編 + 必要証拠 7/6 + アシスト勝利不可 WARN
- ch6: アイコン能力 4 種 grid + 宣言能力構文解説 + タイミングアイコン chip
- ch7: 6 キーワード (icon + 説明 + 例)
- ch8: 5 上級トピック (MR / 色制限 / スタン / 数値修正 / セット)

### D. ResultScreen 練習試合連携
- 終局確定時に `consumePendingPractice()` で章番号取得
- `result.winner === 'self'` なら該当章の全 step を `markChapterStepsCleared` で一括 cleared
- 敗北では章クリアしない (再挑戦推奨)

## 検証

- tsc + build green
- meta-app e2e **24/24 全緑** (Phase 14 既存 19 件 + Phase 15 tutorial 5 件)
  - 8 章すべてリスト表示
  - step クリック → localStorage に `tutorialClearedStepIds` 含まれる
  - ch2 で CardAnnotated 4 種表示
  - ch4 で「ネクストヒント」「リフレッシュ」+ WARNING 表示
  - ch7 で 6 キーワードすべて表示
- 既存 `src/` git diff = 0 (Phase 10-14 から継続)

## 持ち越し (Phase 16+)

- 動的 unlock (章チェーン unlock) — 開発が落ち着いてから
- 各章末にクイズ追加
- 練習試合中に src/ TutorialOverlay を active 化 (現ステップ highlight)
- 各章専用の練習試合シナリオ
- ReplayScreen 実盤面再生
- バンドル分割

## 関連
- 前: [13-implementations.md](13-implementations.md)
- 実装: `meta-app/src/{screens/TutorialScreen,screens/tutorial/illustrations,screens/ResultScreen,state/metaStore}.tsx`
- e2e: `meta-app/tests/e2e/tutorial.spec.ts`
- 参照: 公式ルールマニュアル Ver 2.4 (https://conan-tcg.commmune.com/) + 初めての方へ (https://www.takaratomy.co.jp/products/conan-cardgame/beginner/)
