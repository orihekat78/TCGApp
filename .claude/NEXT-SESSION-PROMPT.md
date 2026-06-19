# 次セッション再開プロンプト (2026-06-19 — CPU可視化機能セット完了 / 次は要選択)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-19、main = 9facc5fa)
「人間vsCPU 操作可視化 + 割り込みロック」機能セットは **完了・main 取込み済・push 済**:
- Task1-4 (割り込みロック / per-move 可視化 / ぴこんポップ) + BUG-151 (カットイン誤発火) = `1e3dcc80`
- Task5 (FLIP 移動アニメ) = `9facc5fa` (CI run 27800793662、merge 時点で in_progress → green 要確認)
詳細: .claude/sessions/2026-06-19.md / memory.md セッション㉓㉔ / .claude/changelog-entries/2026-06-19-01-*.md。

## Task5 サマリ (検証済: tsc0 / vitest 2658(+12) / e2e 2 / 既存e2e 6 回帰なし / lint errors=0)
新規 src/ui/hooks/useFlipAnimation.ts: 現場カードの reflow を FLIP で移動トゥイーン。
MutationObserver(childList) 駆動 (ゴースト消滅=SceneArea内部state も拾える)。zoom(BUG-150) 補正 +
sleep/stun/pop の computed matrix 合成で回転保持。SceneArea 実カードに data-flip-id / Playmat に boardRef+hook。
スコープ=reflow 移動のみ (タップ横向き/登場ポップは既存 CSS で動作済)。

## 次にやること (要ユーザー選択 — 確定タスクなし)
最有力スレッド = **デザイン刷新** (memory: project-design-redesign-2026-06-19)。
- DESIGN.md 前段 (方向性ブレスト) で中断中。再開ファイル = .claude/design/RESUME.md。
- frontend-design skill 導入済 (/frontend-design)。コナン=青基調+赤黒ロゴ専用+茶レンガ=原作identity。署名(キーホール)は未確定。
他候補: カード追加 wave (green候補/certify、card-wave skill) / bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ。
→ セッション開始時にユーザーへ「次はデザイン刷新の続き? カード追加? それとも別?」と確認すること。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正例外のみ。通常は AI/UI 層。TDD・1 task=1 commit=セッション境界。
- Read hook が file を line1 で切る → Bash cat で読む / Edit 前に Read 1 回で登録。
- pre-commit = docs:check + 規約 lint。新 src/test/spec で structure/mapping 変わる → npm run docs 同期後 commit。
- 実機確認は playwright (localhost:5173)。MCP browser が profile lock で繋がらない時は `npx playwright test` で
  tests/e2e/helpers (setupGamePage/buildGameState/getGameState) を使った spec を書くのが確実。
```

CPU可視化機能セット (Task1-5 + BUG-151) 完了・main 取込み済。**次タスクは未確定** — 開始時にユーザー確認。`/clear` 後の新セッション推奨。
