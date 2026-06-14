# 作業ログ — 名探偵コナンTCG プロジェクト

> 履歴: cluster2/BUG-140 → sessions/2026-06-13.md。cluster3 → sessions/2026-06-14.md +
> changelog-entries/2026-06-14-01。cluster4 → sessions/2026-06-14-2.md + changelog-entries/2026-06-14-02。

## 現在地 (2026-06-14) — engine拡張 wave#2 cluster4 ✅ (branch cards/wave2-cluster4、commit 前)

承認済 work order ④ の engine拡張 wave#2。cluster3 完了後、ユーザー選択で (A) cluster4 を実施。

### remove-area → deck-bottom 解禁 6枚 (4設計) / DEFER B07025

- 比較 triage (6 gate × opus, 690k tok) で最高歩留り × 最低リスクと確定 (vs usage restriction 5枚/med risk)。
- engine additive 2 プリミティブ: 新 Cost `removeAreaToDeckBottom` (sceneToDeckBottom の remove 版) +
  新 AtomVerb `removeAreaAllToDeckBottom` (B08027、両者 remove 全部→各自 deck 下+両 shuffle、自己含む/refresh でない)。
- 8 サイト additive (effect.ts / cost evaluate+pay / atom-handlers / validate.ts / cjs / useActionsPanelFlow / ability-activate)。
- カード: B08051/P 赤井秀一・B08066/P 上原由衣・B03059 土井塔克樹・B08027 長門秀臣 (hand-authored full-def)。ALL_CARDS 1152→1158。
- 敵対設計レビュー 3 lens: engine 設計 approve、全員 blocker = pick 短縮形誤り (n:{}+nested target は無音 no-op、BUG-130 系) → flat max:1+filter に全句修正。

### 検証ゲート (全 green)

tsc 0 / sync-whitelists 5/5 / 挙動テスト 12 新設 (cost/verb プリミティブ + 各カード decoy 付) /
full vitest **2086** (+12, regression 0) / smoke:1000 baseline 完全一致 (avg 10.863≈10.86 / winsA 469 /
timeouts0 / exceptions0) / playwright MCP 実機 1試合 (console err = favicon のみ)。

### 残作業 (このセッション)

npm run docs → pre-commit (docs:check + lint 8本) → commit → main ff-merge → push → CI green。

## 繰越 (DEFERRED-INDEX 記載)

- DEFER B07025 (triage 誤分類、動的 levelMax-from-cost filter 不在)。
- 既知 gap: B08066 cost の《諸伏高明/大和敢助》leave:remove-area 反応 (hook 不在 + 反応元 B05087/B05088 未実装で安全)。
- cluster3 繰越: reasoning refresh / BUG-143 (contact-scope 清掃) / BUG-144 (case guard 窓) / U1/U2 (要公式照会)。

## ポインタ

- 設計記録: `.claude/specs/engine-wave2-cluster4-remove-area-design.md` / cluster3: `engine-wave2-action-triggers-design.md`
- triage/設計レビュー出力: `.tmp/cluster4-triage.json` / `.tmp/cluster4-design.json` (再集計 `.tmp/cluster3-recount.cjs`)
- bug: BUG-141/142 修正済、143/144 未着手 (.claude/bugs/index.base)
