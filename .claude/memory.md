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
  B01094・B09044) 検出・修正。教訓 26
- [.claude/sessions/2026-06-06-3.md](sessions/2026-06-06-3.md) — タスク E (BUG-083 = throw 解消済を確認・
  test 追加) + C #1 (reasoning hook 解禁: reasoning:end を card-triggerable 化 + B01017/B01074。
  ALL_CARDS 935)。次は C 残 (reasoning 残 ~13 / disguise / event→evidence / look-top-N) → A → D
- [.claude/sessions/2026-06-06-4.md](sessions/2026-06-06-4.md) — C disguise-hook 解禁 (1ユニット, commit c15ad259):
  disguise:into を TRIGGERED_HOOKS 追加 (additive) + canDisguise に変装ゲート条件 (caseColor/fileAtLeast) 評価。
  カード D06012/B03129/B02045。ALL_CARDS 938。+ **BUG-124** (commit 9a36b166, review 水平展開検出): caseTrait が
  caseTraits 未参照の field-drop を union 修正。vitest 1818 pass 回帰0 / e2e (disguise 2 + case-trait 4) pass。
- [.claude/sessions/2026-06-06-5.md](sessions/2026-06-06-5.md) — C event→evidence 解禁 (commit f8526b97 + 8ba5fa28):
  新 verb `selfToEvidence` (イベント自身を remove→evidence 表向き化) 追加 + B0401x 5色 + PR再録12枚 = 全17枚。
  vitest 1822 pass 回帰0 / e2e 1 pass / review (4 agent) で additive・文言忠実確認。ALL_CARDS **955**。
- [.claude/sessions/2026-06-06-6.md](sessions/2026-06-06-6.md) — C reasoning 残 **全数分類** (10並列 workflow) +
  reasoning-hook batch #3 (engine変更0): B05039 (multi-target charModifyAP) / B03096 (捜査1=deckRevealUntil(opp) 代替)。
  **+ optional 決定の配線** (pendingEffectOptional、pendingEffectChoice 同型 additive engine 機構) + B05019 中道和志。
  「〜してもよい」を human に「する/しない」surface。vitest **1834 pass** 回帰0 / e2e 5 pass。ALL_CARDS **958**。
  次: reasoning 残 (evidence抑制/triggerChar-target/set-card除去/multi-hook共有limit/MR2色) or A (engine変更0 大量) → D

- [.claude/sessions/2026-06-06-7.md](sessions/2026-06-06-7.md) — C reasoning 残 new-feature シリーズ **全完了**
  (お勧め順 ①〜④): ① triggerChar→target (`$trigger.uid/gained`) + B05080 / ② multi-hook 共有【ターン1】
  (TriggerDef.hooks[] + action:declare payload uid/player) + D03007/B04039/B02004系 / ③ set-card 除去
  (charRemoveSetCard) + B08034/P / ④ evidence 抑制 (evidenceToDeck + optional triggerPayload) + B03038。
  ⑤ B09047 のみ DEFER (engine 構造 = isMR/色数 filter 無 + partner-area MR 列挙枠無、※「データ無」は誤り)。
  vitest **1851 pass** / 全 e2e 115 pass / 回帰0 / ALL_CARDS **967**。**C 完了**。
- [.claude/sessions/2026-06-06-8.md](sessions/2026-06-06-8.md) — **タスク A 着手** (engine 変更 0)。再サーベイ:
  カタログ 2049 / 実装 967 / 残 **1082** (= 661 distinct signature)。batch #1 = 既存実装と byte 一致の
  **完全再録 11 枚** (spread パターン、engine 不変)。vitest **1851 pass** 回帰0 / ALL_CARDS **978**。
  ⚠ gate 表 `card-impl-engine-gates.md` は 2026-06-04 stale。**再分類 workflow を実行 → 部分完了**
  (240/661 sig 後 rate-limit + subscription-access block で中断、agent 53/~75)。成果: 70KB capability-map
  (gate 表を置換、hook 9→13個) + 🟢4 (B07041/B07047/B07057/B07058=8枚) + 🟡226 + ⚫10。
  → [.claude/specs/catalog-survey-2026-06-06/](specs/catalog-survey-2026-06-06/)。残 chunk 12-33 は次回再実行。
  meta-app Phase 18 は別セッション進行中 → 不可触。
- [.claude/sessions/2026-06-06-meta-app-phase18.md](sessions/2026-06-06-meta-app-phase18.md) — **別ワークストリーム** (meta-app/ + .claude/ のみ、engine/cards 不可触)。
  5174 を Master Duel 参考に全面リデザイン + **同ID(cardId)3枚ルール是正** (BUG-125)。SAMPLE_DECK_OPP 事件混入 + migration 修復 (BUG-126)、
  リデザイン回帰群 (BUG-127)。CardDef.id / DeckRecord.case / 共有FilterRail / デッキコード / テストハンド。e2e 非tutorial 26 pass。**完了**。

**次セッション方針 (arumi 希望): A — engine変更0 の大量カードバッチ**。C で engine 機能が大幅増 → 「engine 不変で
実装可能なカード」が増えた。まず残カタログを再サーベイ (実データ裏取り) → 🟢 を均質バッチで実装。詳細は NEXT-SESSION-PROMPT。

次セッション kickoff: [.claude/NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md)
