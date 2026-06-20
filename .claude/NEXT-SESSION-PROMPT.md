# 次セッション再開プロンプト (2026-06-21 — wave DSL再author main取込み済 / 次は B/C 強推奨)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-21、main = e295ee16 = 取込み済・push 済)
カード追加 wave「DSL 再author」(engine変更0、3rep/5刷) を **main 取込み済・push 済**。
- CI run (e295ee16) は push 時 in_progress。次セッション開始時に `gh run list -L1` で green 確認。
詳細: memory.md セッション㉗ / .claude/changelog-entries/2026-06-21-01-*.md / DEFERRED-INDEX。

## wave サマリ (検証済: engine変更0確証(git diff engine/_shared無) / tsc0 / vitest 2686 / 新decoy 28pass /
   smoke exc=0・baseline不変(avg11/winsA498) / e2e 120pass(1fail=spectator-speed pre-existing無関係) / 敵対verify opus 6/6 ship・refuted0)
出荷 3rep/5刷 (ALL_CARDS 1357→1362、全 engine変更0 = 既存 verb/cond/hook のみ):
- B02026 綾小路文麿: a1 action:declare観測者 triggerCharMatches{side:opp, filter:{}} +draw1 / a2 ヒラメキdraw
- B04004/P 毛利蘭: a1 partnerColorKeyword(青/迅速) / a2 contact-removal観測 / a3 actor+target gate (payloadKey:targetUid) +絆 +active化
- B09097/P コルン: 登場時 caseColor赤黒&事件編 → discard(赤/黒)→draw2→L7+でmill opp3
旧 refuted の真因と fix は memory.md ㉗ / DEFERRED-INDEX 参照。

## 次にやること (要ユーザー選択 — A はほぼ枯渇、B/C 強推奨)
A) カード追加 wave 継続: **standing green queue 枯渇 + DSL-fix refuted も今回で出し切り**。残 DEFER は
   ほぼ全て engine gate (multi-match / dynamic-count / MR / partner-area / name-designation / aggregate-budget /
   cross-side aura / handToEvidence 等)。engine変更0 の残弾はほぼ無し → **生産性ほぼ尽きた。非推奨**。
   どうしても続けるなら DEFERRED-INDEX を engine 拡張 cluster 単位で再設計 (= 骨格解凍を伴う = 別判断)。
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ (engine 解凍を伴う cluster 含む)。
→ 開始時にユーザーへ方向確認。A 選択時は「engine変更0 はほぼ尽き、engine拡張 cluster になる」旨を明示。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- Read hook が file を line1 で切る → Bash cat で読む / Write・Edit は Bash heredoc/sed で代替可。
- pre-commit = docs:check + 規約 lint。新 src/test/spec で structure/mapping 変わる → npm run docs 同期後 commit。
- カード wave: **certify/敵対verify GREEN でも codegen 前に shipped exemplar と全句突合必須**。
  decoy で filter/gate を実 engine 経路で1対1検証 (非MVP は decoy unit test が唯一の engine 駆動証跡)。
- 「既知 fix」(DEFER note 等) は hint であって保証でない。今回 B09097 の「optional ラップ必須」note は誤りで bare-chain が正だった (shipped twin 突合で判明)。
```

カード wave DSL再author (3rep/5刷) **main 取込み済・push 済**。次タスク未確定 — 開始時にユーザー確認 (A はほぼ枯渇、B/C 推奨)。`/clear` 後の新セッション推奨。
