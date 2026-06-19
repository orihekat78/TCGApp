# 次セッション再開プロンプト (2026-06-19 — カード wave declared-cost main取込み済 / 次は要選択)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-19、main = 9f3ad664 = 取込み済・push 済)
カード追加 wave「declared+cost / enter-observer」(engine変更0、3枚) を **main 取込み済・push 済**。
- CI run (9f3ad664) は push 時 in_progress。次セッション開始時に `gh run list -L1` で green 確認。
詳細: memory.md セッション㉖ / .claude/changelog-entries/2026-06-19-03-*.md / DEFERRED-INDEX。

## wave サマリ (検証済: tsc0 / vitest 2686(+13 decoy) / smoke exc=0・baseline不変(avg11/winsA498) / e2e 121pass / certify(opus) 3/3 green+verifyOk)
出荷 3枚 (ALL_CARDS 1354→1357、全 engine変更0 = 既存 verb のみ):
- B07066/B07066P 赤井秀一: a1 enter-observer (自分側 level≤7 赤井家 登場で AP8000以下1枚remove、B04017同型)
  + a2 宣言 sleepChar(自/赤井家)cost→look-3赤井家→加えたら discard1 (B05078同型)
- PR194 灰原哀: 宣言 removeFromScene{self}cost→look-2 forced-top (filter省略=match-all、B01048同型)
DEFER: B08075「3つまで選んで行う」= bare sequence 化は opt3(look-4)が 0-take でも deck並べ替え副作用で
  unskippable(fatal)。certify GREEN を self-review 全句突合で false-green 検出 (DEFERRED-INDEX 参照)。

## 次にやること (要ユーザー選択)
A) カード追加 wave 継続: standing queue 枯渇、残 green は diverse tail で生産性逓減。次候補は
   DEFERRED-INDEX の DEFER 群を engine 拡張要否で再評価 (大半は multi-match/dynamic-count/MR 等 engine gate)。
   card-wave skill。低生産性のため B/C を推奨。
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ。
→ 開始時にユーザーへ方向確認。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正例外のみ。通常は AI/UI 層。TDD・1 task=1 commit=セッション境界。
- Read hook が file を line1 で切る → Bash cat で読む / Edit 前に Read 1 回で登録。
- pre-commit = docs:check + 規約 lint。新 src/test/spec で structure/mapping 変わる → npm run docs 同期後 commit。
- カード wave: **certify GREEN+verifyOk でも codegen 前に shipped exemplar と全句突合必須** (㉖ B08075 で false-green 検出)。
  green候補は未certify なら信用しない。decoy で filter 実評価を1対1検証 (非MVP は decoy unit test が実 engine 経路駆動)。
```

カード wave declared-cost (3枚) **main 取込み済・push 済**。次タスク未確定 — 開始時にユーザー確認。`/clear` 後の新セッション推奨。
