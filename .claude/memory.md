# 作業ログ — 名探偵コナンTCG プロジェクト

過去のセッションログ: [.claude/sessions/](sessions/)

## 2026-05-22 セッション 18 (user_request 20260522_01 16 件 + 派生 + Phase 5/6)

### user_request 20260522_01 (16 件本体 + 関連)

| # | 内容 | BUG | commit |
|---|---|---|---|
| 1 | バグフォルダ audit + 教訓集 | AUDIT/LESSONS-LEARNED | `2db6bf5` |
| 2 / 6 | 任意効果 auto-pick 停止 + UI 統合 | BUG-053 + BUG-054 | `7b1e86b` `bacc22b` |
| 3 | log カード名 | BUG-060 | `78a93f2` |
| 4 / 16 | FILE 7+ 解決編 auto-phase 経路配線 | BUG-050 | `cdc0725` |
| 5 | 事件カード能力 (scope='always') | BUG-051 | `d558f8c` |
| 7 | cutin actor 名 | BUG-055 | `4d24567` |
| 8 | action[事件] ガード時証拠誤変動 | BUG-049 | `4d32418` |
| 9 | 手札虫眼鏡 | BUG-056 | `761d46a` |
| 10 / 13 | Q&A clarification | docs only | `9fd65f8` |
| 11 | リムーブ拡大 | BUG-057 | `52a2adf` |
| 12 | D11019 bind ref + 演出 | BUG-052 + BUG-061 | `f85edfe` `2894c61` |
| 14 | speed preset 拡張 | BUG-058 | `ca23f9e` |
| 15 | CPU 可視化 spec + 案 1/2 実装 | BUG-059 + 062 + 063 | `094805b` `5394ee4` `99f6c0c` |

### AUDIT 派生

- commit hash 12 件補填 (`9b36f5f`)
- BUG template + lint script (`ebeebed`)
- side-channel pattern doc (`f53598c`)
- category enum migration 29 件 → warns=0 (`bf19605`)

### Phase 5: BUG-036 deck-out 敗北条件配線 (`1480465`)

`draw()` で refresh 失敗時 `gameResult.set(opp, 'deck-out')` 配線。
既存 gameResult 上書き gate 付き。test 3 件追加 (1547 → 1551 PASS)。

### Phase 6: 9 BUG status 正規化 (`a68f58b`)

「対応中・見送り・仕様外」9 件を全て 修正済 に正規化。**全 62 BUG が
修正済 status** (errors=0 / warns=0) 達成。

### 数値
- vitest 1551 PASS / 1 skipped
- E2E 53 PASS / 1 skipped
- smoke 1000 戦: avg 10.64 / 0 timeout / 0 exception
- lint:bugs: 62 BUG / errors=0 / warns=0
- 80+ commit を origin/main へ push
