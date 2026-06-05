# 作業ログ — 名探偵コナンTCG プロジェクト

直近セッションの詳細は日次ログへローテート済:

- [.claude/sessions/2026-06-05.md](sessions/2026-06-05.md) — Engine 拡張 batch #1〜#5
  (engine 変更 0、ALL_CARDS 859→933、最新 commit a8aa42c4)
- [.claude/sessions/2026-06-05-2.md](sessions/2026-06-05-2.md) — カード text-faithfulness 監査
  (Playwright 実機検証 + 多エージェント監査 workflow)。BUG-117/118/119/120/121 の engine バグ
  5 系統を検出・修正 (`427a4754`/`b3885daf`/`f5437e9f`/`c410db60` push 済)
- [.claude/sessions/2026-06-06.md](sessions/2026-06-06.md) — BUG-121 残課題の全解消
  (sequence 内 choice 汎用化 / bug-077 flaky 解消 / suspect 全検証) + Playwright text-faithfulness
  検査の規約化 + 教訓ファイル更新運用の明文化 (LESSONS-LEARNED-3.md)
- [.claude/sessions/2026-06-06-2.md](sessions/2026-06-06-2.md) — タスク B (text-faithfulness 監査 横展開)。
  engine フィルタ評価経路の全数突合 + 多エージェント監査 (358 枚) → BUG-122 (icon-keyword:
  filter.keyword がアイコン能力未検出 / B05112) + BUG-123 (kind:'character' 欠落で event 混入 /
  B01094・B09044) 検出・修正。教訓 26。次は E (BUG-083)

次セッション kickoff: [.claude/NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md)
