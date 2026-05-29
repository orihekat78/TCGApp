---
date: 2026-05-29
title: Phase 15 — チュートリアル完成 (8 章 + 進捗 persist + 練習試合連携、rules/01〜26 網羅)
type: feat
scope: meta-app
---

## ユーザー指示

> チュートリアルを完成させたい
> チュートリアルにはキャラクター、イベント、事件、パートナーカードのそれぞれの記載の説明をしてくれるシーンも作成してほしい
> 特有のキーワードについてのチュートリアルも実装したい (疾風・突撃など)
> 他にルールを参照してみて、チュートリアルに加えたほうがいい内容を加えてほしい
> 動的アンロックは今実装しないでほしい
> 公式ページ (takaratomy + commmune) を Playwright で参照して

Phase 14-D で骨格はあったが、章 4 のみ Illustration / step state ハードコード / persist なしという未完成状態。Phase 15 で標準スコープ実装 (動的 unlock 除外)。

## 主要変更 (`meta-app/` のみ)

### A. metaStore 拡張 (15-A)
- `Settings.tutorialClearedStepIds: string[]` + persist + hydrate fallback
- `_pendingPracticeChapter: number | null` (transient、persist しない)
- actions: `markStepCleared` / `markChapterStepsCleared` / `isStepCleared` / `startPracticeFor` / `consumePendingPractice`

### B. TutorialScreen progress-driven (15-B)
- 旧 6 章 hardcoded → **新 8 章** progress-driven 構造に書換
- ChapterList を 2 グループ (「初めての方は」beginner 4 / 「詳しく知りたい方」advanced 4) + 番号バッジ
- step state 算出: `cleared` / `current` (章内最初の未 clear) / `pending`
- 動的 unlock 撤回 (開発中のため) — 全章常時アクセス可
- step click → `markStepCleared` → persist

### C. 全 8 章 Illustration (15-C, `screens/tutorial/illustrations.tsx` 一括)
公式 https://www.takaratomy.co.jp/products/conan-cardgame/beginner/ と https://conan-tcg.commmune.com/ (ルールマニュアル Ver 2.4 全 27 ページ) を Playwright で参照、章構成と Illustration デザインに反映:
- 共通プリミティブ: `Panel` / `SectionLabel` / `TermRow` / `PointBox` / `WarnBox`
- **ch1** 基本ルール: 7 エリア構造 (相手陣 / 自陣 鏡像)
- **ch2** カードの読み方 🆕 (公式 P3-5 参考): `CardAnnotated` + `CalloutPill` 新規、キャラ/イベント/事件/パートナーの 4 種をそれぞれ番号注釈付きで解説
- **ch3** ゲーム開始からターン進行: マリガン 6 ステップ + 3 フェイズ flow
- **ch4** キャラ行動とリソース管理: 推理 vs アクション + コンタクト AP 比較 + ネクストヒント + リフレッシュ + 敗北 WARN
- **ch5** 解決編とアシスト勝利不可: 事件編→解決編 + 必要証拠 7/6 + WARNING
- **ch6** 効果と能力: アイコン能力 4 種 grid + 宣言能力構文解説 + タイミングアイコン chip
- **ch7** キーワード能力 🆕: 6 キーワード (疾風 / 突撃 / 迅速 / ブレット / 捜査 / 痕跡) icon + 説明 + 例
- **ch8** 上級者向け: MR / 色制限 + スイッチ / スタン特殊 / 数値修正 / セット vs 下に重ねる の 5 セクション

### D. ResultScreen 練習試合連携 (15-E)
- 終局時に `consumePendingPractice()` で章番号取得
- `result.winner === 'self'` なら該当章 (ch5 = 解決編) の全 step を `markChapterStepsCleared` で一括 cleared
- 敗北では章クリアしない (再挑戦推奨)

### 公式ルール網羅
| rules | カバー章 |
|---|---|
| 01 勝利条件 / 02 デッキ / 03 エリア / 04 開幕 / 05 ターン / 06 種別 | ch1, ch3, ch5 |
| 07-08 アクション / 09-10 cutin-hirameki / 11 推理 / 12 NH / 13 keywords / 14 refresh | ch4, ch5, ch6, ch7 |
| 15 / 16 / 17 / 18 / 19 / 20 / 21 / 22-26 Q&A | ch6, ch7, ch8 |
| 27-30 制限/エラッタ/フロアルール | ❌ out of scope (競技規定) |

## 不変条件 (継続遵守)

- ✅ `src/` 配下 1 行も変更なし (Phase 10-14 から継続)
- ✅ Phase 11 統合経路保持 (`useGameStateStore` / `setGameState` / `customGameStart`)
- ✅ 既存 vitest / playwright e2e 全件無修正で緑

## 検証

- tsc + build green
- meta-app e2e **24/24 全緑** (Phase 14 既存 19 件 + Phase 15 tutorial 5 件)
  - 8 章すべてリスト表示 (2 グループ label 含む)
  - step クリック → localStorage `tutorialClearedStepIds` 含まれる
  - ch2 CardAnnotated 4 種表示
  - ch4 「ネクストヒント」「リフレッシュ」+ WARNING 表示
  - ch7 キーワード 6 種すべて表示
- 5174 で:
  - 全 8 章クリック可能 (locked なし)
  - 各章右パネルに Illustration 表示
  - step click → 進捗 bar 更新 + リロード後も persist
  - ch5 練習試合 → 勝利 → ch5 全 step 自動 cleared
  - HOME ホームへ戻っても 進捗保持

## 仕様 / 記録

- `.claude/specs/meta-ui/14-tutorial-complete.md` 新規 (78 行) + INDEX 登録
- `.claude/changelog-entries/2026-05-29-01-phase-15-tutorial-complete.md` (本ファイル)

## 持ち越し (Phase 16+)

- **動的 unlock** (章チェーン unlock) — 開発が落ち着いてから
- 各章末にクイズ (選択式) 追加
- 練習試合中に src/ TutorialOverlay を active 化 (現ステップ highlight)
- 章ごとに専用の練習試合シナリオ (ch4 → コンタクト、ch6 → カットイン 等)
- ReplayScreen 実盤面再生
- バンドル分割
