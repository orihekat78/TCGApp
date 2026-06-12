# 作業ログ — 名探偵コナンTCG プロジェクト

> 80 行ルールで sessions/ にローテート済。直近の詳細は各 session log を参照。

## 現在進行中 (Task A green候補 刈り取り = batch#2)
- **本 conversation の成果 86枚 (うち certify-harvest) 全未 commit** (HEAD=8560a8d0)。commit は arumi 手動運用、指示待ち (main なので branch first 要)。
  - B01011 + wave1 11 + wave2 9 + harvest#1/wave3 8 + harvest#2 15。ALL_CARDS **1084** / 全ゲート green。
- **certify workflow** (`scripts/wf-certify.mjs`): green候補 254 を grounding→adversarial-verify。**254/254 certify 完了** (green 70 auto + 5 needsManual / yellow 176)。
  残138を id-based 単一 workflow (wln6mwwz0) で継続中 (バックグラウンド)。1rep≈200k tokens, 窓毎~20rep, SUB=8 で throttle 回避。
- 詳細: [sessions/2026-06-11.md](sessions/2026-06-11.md) / [sessions/2026-06-10.md](sessions/2026-06-10.md)。
- DEFER: B02073 (cost 解釈疑義, e2e 確認まで)。複合 look-N / declared-cost 系は精査 wave で。

## 2026-06-11 (別タスク): dev-knowhow-kit 作成
- ユーザー依頼「ノウハウ + MCP 構成を他フォルダへ持ち出せるキットをリポジトリ直下に」→ `dev-knowhow-kit/` 完成 (31 files、未 commit)。
- 構成: README + setup-checklist (Phase1-6) / mcp (.mcp.json + 再登録手順) / templates 7 種 / scripts-portable (lint・bug-trend・gen-docs 汎用2本・start.bat) / knowhow 9 編。
- 抽出は Workflow 6 並列 (50 practices) + 補完 critic → 敵対的 review fatal0/minor10 → 全件修正 → smoke (lint guard / gen-docs check) 動作確認済。
- ⚠ ~/.claude.json に GitHub PAT 平文を発見 → キットには placeholder 化。ユーザーへ revoke 推奨を報告済。

## 2026-06-12: Task D engine拡張 wave#1 — ✅完了 (未commit)
- E0〜E4 + guard自己ガード除外 + charGrantKeyword短縮形。カード35枚 (ALL_CARDS 1057)。
- 全ゲート green: vitest 1961/0fail・smoke baseline一致・e2e 22+4+3・lint 0err。BUG-128/129/130 修正済。
- 詳細: sessions/2026-06-12.md。DEFER: DEFERRED-INDEX.md「Task D wave#1 繰越」節。
- 次: ユーザーゴール=全体リファクタリング計画 (フェーズ分割・厳格レビュー) 作成→実行。

## 2026-06-12 (続): 全体リファクタリング着手
- 棚卸し2本 (engine/cards + UI/scripts/tests、Explore agents) → `.claude/specs/refactor-plan/` (INDEX+phases)。
- Phase 1a (mutate バイパス直書き5箇所是正) + 1b (__pendingActionExpansion dead push 除去) 実行・検証済
  (vitest 1961/smoke baseline完全一致/e2e 17)。レビューで charSetAP/LP 削除は却下 (意図的ガード)。
- 次: Phase 1c (fixture 統一 75→3) から phases.md の順に。1フェーズ=1commit 厳守。
