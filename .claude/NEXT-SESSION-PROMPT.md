# 次セッション再開プロンプト (2026-06-19 — カード wave deckLook-bottom main取込み済 / 次は要選択)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-19、main = c608c756 = 取込み済・push 済)
カード追加 wave「deck-look→手札+残りデッキ下」(engine変更0、4枚) を **main 取込み済・push 済**。
- CI run 27805693259 (push 時 in_progress)。次セッション開始時に `gh run list -L1` で green 確認。
詳細: memory.md セッション㉕ / .claude/changelog-entries/2026-06-19-02-*.md / DEFERRED-INDEX 末尾。

## wave サマリ (検証済: tsc0 / vitest 2673(+15 decoy) / smoke exc=0・baseline不変 / e2e 120pass(1 env flake) / 敵対verify 0 blocker)
出荷 4枚 (ALL_CARDS 1033→1037、全 engine変更0 = 既存 verb のみ):
- B05078/B05078P 世良真純: 登場時 look-4 filterAny[赤井家|探偵] 1枚まで手札→残りデッキ下→加えたら discard1 / ヒラメキ draw (B03007 同型)
- B03056/B03056P 千間降代: 登場時 look-1 探偵 / ターン終了時 探偵sleep≥3→self-remove→証拠1 (B04024+B06081 同型)
所見: standing certify queue 枯渇。sweep の「hand→deck-bottom verb 無」note は stale (wave1 で deckToBottomBound 追加済)。
contact-removal-by-self 族 (21rep) は 28/39 出荷済で gate 閉鎖済。

## 次にやること (要ユーザー選択)
A) カード追加 wave 継続: 次wave候補 = B07066/PR194/B08075 (declared+cost / multi-select-3、composite だが verb 既存=certify で出荷可能性)。
   card-wave skill。残 green は diverse tail で生産性逓減 (DEFERRED-INDEX 参照)。
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ。
→ 開始時にユーザーへ方向確認。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正例外のみ。通常は AI/UI 層。TDD・1 task=1 commit=セッション境界。
- Read hook が file を line1 で切る → Bash cat で読む / Edit 前に Read 1 回で登録。
- pre-commit = docs:check + 規約 lint。新 src/test/spec で structure/mapping 変わる → npm run docs 同期後 commit。
- カード wave: green候補は未certify なら信用しない。全句を engine code + 公式テキスト + rules で裏取り。decoy で filter 実評価を1対1検証。
```

カード wave deckLook-bottom (4枚) **main 取込み済・push 済**。次タスク未確定 — 開始時にユーザー確認。`/clear` 後の新セッション推奨。
