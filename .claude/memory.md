# 作業ログ — 名探偵コナンTCG プロジェクト

過去のセッションログ: [.claude/sessions/](sessions/)
次セッション引継ぎ: [.claude/sessions/NEXT-SESSION-PROMPT.md](sessions/NEXT-SESSION-PROMPT.md)

## 2026-05-23 セッション (BUG-064 〜 BUG-077 cascade)

### 概要

D08015 (小嶋元太) ワークフロー作成依頼から始まり、a1 機能不全発覚 → resolve-picks pattern B 修正 → 連続 incomplete fix 発覚 → 各々修正。**BUG-066 で立てた「修正済 前の 4 点 verify protocol」を 6 回連続で破った**反省記録。

### 主要 commit (24 件)

| BUG | commit | 概要 | 状態 |
| --- | --- | --- | --- |
| BUG-064 | 8c2f3e2 同梱 | ワークフロー図の抽象度漏れ、WORKFLOW-GUIDELINES.md 新規 | 修正済 |
| BUG-065 | 8c2f3e2 | resolve-picks pattern B 対応 | 修正済 |
| BUG-066 | 8c2f3e2 | claude 自己検証漏れ起票、4 点 verify protocol 明文化 | 修正済 |
| BUG-067〜070 | 78679d0 | 全 BUG audit (4 agent 並列) で発覚した 4 件起票 | 未着手 |
| BUG-071 | 37ffb3a | triggered listener sequence pre-step skip 廃止 | 修正済 |
| BUG-072 | 6297ed4 | effect log + ACTION_LABEL 日本語化 | 修正済 |
| BUG-073 | 6c6d685 | 全 atom log + pattern B カード水平展開 verify | 修正済 |
| BUG-074 | 4f72085 | evidenceToHand/handAddFromRemove target string\|array 両対応 | 修正済 |
| BUG-075 | ac2cfe6 | side-channel 上書き防止 | 修正済 |
| BUG-076 | 8d18c4f | tryRePickFromAtom + evidence kind 対応 | 修正済 |
| **BUG-077** | **f022d72** | **D08013 a1 step 2 が UI 経路で反映されない** | **対応中** (engine logic 4/4 PASS、UI trace 要) |

### 既存 BUG 訂正 (78679d0)

- BUG-035 / 045 / 048 / 053 / 054: 「修正済」過大 claim を訂正、BUG-065 で初完全動作
- LESSONS-LEARNED 教訓 11: 4 点 verify protocol 厳格化

### 検証

- vitest 1573 PASS / 1 skipped
- typecheck clean
- smoke:1000 timeouts=0 exceptions=0 winsA=511 winsB=489

### 残課題

1. **BUG-077 RCA Phase 2** — Playwright trace (詳細は NEXT-SESSION-PROMPT.md)
2. **BUG-067〜070** — case declared limit / resolveBindRef 拡張 / LogPanel uid / BUG-009 残 4 項目
3. ユーザー実機 verify: D08015 a1 + D08013 a1

### メタ反省

- 「修正済」前に 4 点 verify ([BUG-066](bugs/BUG-066.md) + 教訓 11) を徹底
- engine 関数修正時は caller 側も verify
- カードドキュメントは公式効果テキスト全文を必ず読む
- 複数 pattern B atom を含む sequence の e2e test を fixture に追加
