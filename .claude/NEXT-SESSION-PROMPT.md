# 次セッション再開プロンプト (2026-06-19 — BUG-151 修正済、merge 判断待ち / 残 Task5 FLIP)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP「人間vsCPU 操作可視化 + 割り込みロック」機能。
まず CLAUDE.md → 設計 spec → 実装計画 → memory.md を読む。

## 現在地 (2026-06-19、branch feat/cpu-visualize-interrupt-lock)
最優先 BUG (登場時効果が毎ターン発動して見える) は **修正済・実機検証 OK** (commit c4ec6448、BUG-151)。
core (Task1-4) + fix が branch に揃い、main より 10 commit 先行。**main 取込みはユーザー判断待ち**
(ff-merge 可能。push すると CI が走る)。詳細: .claude/sessions/2026-06-19.md セッション㉓ / .claude/bugs/BUG-151.md。

## ★最初にやること: core+fix を main に取り込む
- 方法: `git checkout main && git merge --ff-only feat/cpu-visualize-interrupt-lock`
  (ユーザーが PR 経由を希望する場合は push → PR → CI green → merge)。
- merge/push 前に CI green を確認 (CLAUDE.md)。CI は main push / PR でのみ走る。
- 取込み後 branch を削除してよいか確認。

## BUG-151 修正サマリ (検証済: tsc0 / vitest 2646 / smoke winsA=498不変 / 実機Playwright)
原因は Task4 regression ではなく「CPU per-move 可視化で顕在化した既存 engine バグ + Task4 UI fallback」の複合:
- D1 (engine): handUseCard のキャラ召喚 effect:declared{character-use} に【カットイン】が誤発火 →
  noop charModifyAP が pendingEffects に resolved 残留 → 効果スタック毎ターン+1。
  handleHook で cutin は payload.abilityId==='cutin' のみ発火に修正。
- D2 (ui, Task4): Playmat activeEffectEntry の `?? pendingEffects[0]` が解決済み entry を拾い幻ポップ →
  find(resolving) ?? find(pending) に。
- D3 (ui): effectStackCount を pending/resolving のみ計上。
水平展開: 全1350カードで guard 無し effect:declared ability は 0 件 (cutin が全件、D1 で閉鎖)。

## ★残 Task5: FLIP 移動アニメ (polish、core と独立)
- 新規 src/ui/hooks/useFlipAnimation.ts (安定 data-uid で描画前後の rect 差分を transform トゥイーン)。
- Playmat/SceneArea/HandZone に適用: 手札→現場スライド登場 / 推理=タップ横向き / アクション=攻撃元が対象へ寄る。
- TDD (jsdom: getBoundingClientRect mock) → 実機 Playwright → commit → main。
- ユーザー確定方針: アニメ度=「標準」(移動トゥイーン+ぴこんポップ)。MasterDuel風、過剰演出なし。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正例外のみ (BUG-151 の D1 がそれ)。通常は AI/UI 層。TDD・1 task=1 commit。
- Read hook が file を line1 で切る → Bash cat / Edit 前に Read 1 回で登録。
- pre-commit = docs:check + 規約 lint 8本。新 src/test/spec 追加で structure/mapping 変わる → npm run docs 同期後 commit。
- 実機確認は playwright MCP (localhost:5173)。window.__game.getState().gameState で live state 参照可。
```

BUG-151 修正済・全ゲート green。**残は (a) core+fix の main 取込み (ユーザー判断) と (b) Task5 FLIP のみ。** `/clear` 後の新セッション推奨。
