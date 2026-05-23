---
date: 2026-05-23
title: pattern B atom resolver 拡張 + 5 連続 incomplete fix 解消 + BUG-077 RCA
type: fix
scope: engine / ui / bugs
---

## D08015 / D08013 起点の resolve-picks pattern B 系譜 (BUG-065 〜 077)

D08015 (小嶋元太) ワークフロー作成依頼から始まる cascade。最終的に 9 新規 BUG 起票 + 既存 5 件訂正 + 17 commit。

### 修正完了 (engine + UI 修正)

- **BUG-065** (`8c2f3e2`): resolve-picks pattern B (uid なし + target.kind='pick') 対応で D08015 a1 step 2 discard が動作
- **BUG-071** (`37ffb3a`): triggered listener の sequence 全体 queue skip 廃止 → pre-pick step (draw 等) 実行
- **BUG-072** (`6297ed4`): effect log + ACTION_LABEL 30 件追加で動作可視化
- **BUG-073** (`6c6d685`): 全 atom (25 種) に effect log + pattern B カード 5 件水平展開 unit test
- **BUG-074** (`4f72085`): evidenceToHand / handAddFromRemove の target string\|array 両対応
- **BUG-075** (`ac2cfe6`): side-channel 上書き防止 (sequence 内複数 pattern B)
- **BUG-076** (`8d18c4f`): tryRePickFromAtom + evidence kind 対応で連続 modal flow

### 起票 (未着手 / 対応中)

- BUG-067〜070 (未着手): 4 agent audit で発覚した残課題 4 件 (case declared limit / resolveBindRef 拡張 / LogPanel uid 解決 / BUG-009 残 4 項目)
- BUG-077 (対応中、`f022d72`): D08013 a1 step 2 が UI 経路で evidence -1 / hand +1 反映されない (engine logic は 4/4 test PASS、UI trace 要)

### メタ修正

- BUG-066 起票: claude 自己検証漏れの記録、4 点 verify protocol 明文化
- LESSONS-LEARNED 教訓 11 追加: 「修正済」transition の 4 点 verify (公式テキスト必読 / 関連ファイル現状確認 / 警告語句 grep / memory observation 検索)
- BUG-035/045/048/053/054: 「修正済」過大 claim を訂正、BUG-065 で初完全動作を追記
- AUDIT-2026-05-23.md: 全 BUG audit 集約 report
- D08015-workflow.md / D08013-workflow.md: 簡易フローチャート作成
- WORKFLOW-GUIDELINES.md: カード処理ワークフロー図ガイドライン新規

### 検証

- vitest 1573 PASS / 1 skipped (1567 + 6 new BUG-073 + 6 new BUG-074 + 4 new BUG-077)
- typecheck clean
- smoke:1000 timeouts=0 exceptions=0 winsA=511 winsB=489 (バランス維持)
