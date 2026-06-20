# 次セッション再開プロンプト (2026-06-21 — distinct-name-count cluster 出荷済 / 次は B/C 強推奨)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-21、セッション㉘ — branch cards/wave-distinct-name-count、commit 後 main 取込み)
engine拡張 micro-cluster「distinct-name-count」(sceneHas distinctNames 計数、4刷) を出荷。
- 開始時に `gh run list -L1` で CI green 確認。
詳細: memory.md ㉘ / .claude/changelog-entries/2026-06-21-02-*.md / DEFERRED-INDEX「distinct-name-count cluster」。

## wave サマリ (検証済: tsc0 / vitest 2724pass1skip0fail / decoy 10pass / smoke exc=0・baseline不変(avg10.998/winsA498) /
   playwright 121pass1skip0fail / 敵対verify opus OVERALL SHIP・refute0)
engine 変更 = src/engine/cond/eval.ts の sceneHas case に `query.distinctNames` honor 分岐 1つ (純 additive、
新 Condition kind 無、既存 flag を計数経路でも honor)。回帰ゼロ確証 = sceneHas+distinctNames 使用既存カード 0。
出荷 (ALL_CARDS 1362→1366): B08067/B08067P 諸伏高明 (enter conditional distinct gate) + PR236/PR242 大和敢助
(declared a2 宣言ゲート distinct gate)。B08063 は a1 self-trait-grant continuous (別 gate) で DEFER 継続。

## ⚠ 重要 — カード追加 (A) は engine変更0 完全枯渇 + 単一 gate yield 3-5 base が上限 (決定論実証済)
今セッション冒頭で `.tmp/gate-yield-scan.cjs` が未実装 685 cardNum を実テキスト走査し、単一 additive gate の
最大実 yield = 3-5 base と確定。残 DEFER は全て engine拡張 cluster (骨格解凍を伴う別判断)。次弾候補は
DEFERRED-INDEX「同セッションで scope した未着手 micro-cluster」: handToEvidence (2 verb, ~3 base) /
continuous levelDelta (effort大・yield小)。**B/C のほうが ROI 高い (強推奨)**。

## 次にやること (要ユーザー選択)
A) カード追加継続 = engine拡張 micro-cluster (handToEvidence or levelDelta、骨格解凍=別判断、低 yield)。非推奨だが可能。
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ (engine 解凍 cluster 含む)。
→ 開始時にユーザーへ方向確認。A 選択時は「engine変更0 完全枯渇・単一 gate 3-5 base が上限」を明示。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- engine拡張 cluster でも「同一 engine パターン 1つに絞る (混ぜない)」「決定論 yield scan で実数確認してから着手」。
- Read hook が file を line1 で切る → Bash cat で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint。新 src/test/spec で structure/mapping 変わる → npm run docs 同期後 commit。
- カード wave: **certify/敵対verify GREEN でも codegen 前に shipped exemplar と全句突合必須**。
  decoy で filter/gate を実 engine 経路で1対1検証 (非MVP は decoy unit test が唯一の engine 駆動証跡)。
- 「既知 fix」(DEFER note 等) は hint であって保証でない。shipped twin 突合で最終確認。
```

distinct-name-count cluster (4刷) commit 後 main 取込み。次タスク未確定 — 開始時にユーザー確認 (A=engine変更0 完全枯渇で非推奨、B/C 推奨)。`/clear` 後の新セッション推奨。
