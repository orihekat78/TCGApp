# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-19.md = ⑱〜㉒。)

## セッション㉓ (2026-06-19) — BUG-151 修正 (CPU可視化で顕在化したカットイン誤発火 + 効果スタック残留)

branch `feat/cpu-visualize-interrupt-lock`。ユーザー報告「人間vsCPU で登場時効果が毎ターン発動して見える」を
systematic-debugging で調査。**Task4 regression ではなく**、CPU per-move 可視化で顕在化した既存 engine バグ +
Task4 由来の UI fallback バグの複合。commit `c4ec6448`。

### 根因 (3) と修正
- **D1 (engine, 既存)**: `handUseCard` のキャラ召喚 emit `effect:declared{kind:'character-use'}` に
  【カットイン】(trigger optional+selfOnly, matcher なし) が誤一致し noop `charModifyAP($contact.byUid)` を
  queue → `pendingEffects` に resolved 残留 (prune されない) → 効果スタックが毎ターン +1。
  修正: `handleHook` で cutin は `payload.abilityId==='cutin'` (真の `flow.contact.cutIn` 起動) のみ発火。
- **D2 (ui, Task4 regression)**: `Playmat` の `activeEffectEntry = find(resolving) ?? pendingEffects[0]` が
  解決済み entry を拾い幻の「効果解決」ポップ → `find(resolving) ?? find(pending)` に変更 (resolved 不採用)。
- **D3 (ui, 既存)**: `effectStackCount = pendingEffects.length` が resolved も計上 → pending/resolving のみに。

### 調査の決定的証拠 (Playwright + window.__game)
- ENTER-HOOK 計測: enter は召喚毎に1回のみ (二重発火なし) → 「登場時」literal バグは否定。
- `pendingEffects` に `effect:declared` の `charModifyAP{$contact.byUid}` が turn 毎に蓄積 (D08017/D08007 cutin)、全 `state:'resolved'`。
- Playmat 計算が `pendingEffects[0]`(stale resolved)を activeCardUid に採用と確認。
- 修正後実機: cutin 召喚後も効果スタック=0 / resolved entry 注入でも幻ポップ0・counter0 / per-move 可視化継続 / console error 0。

### 水平展開 (決定的)
全 1350 カード registry 走査: guard (optional/matcher/matcherCondition) 無しの `effect:declared` ability は **0 件**。
cutin (optional) が誤発火クラスの全件 → D1 で完全閉鎖。非 cutin は全件 kind matcher / matcherCondition で gate 済。

### 検証 (全 green)
TDD `tests/engine/listeners/cutin-summon-misfire.test.ts` (character-use/event-use 非 queue・abilityId:'cutin' queue) /
tsc 0 / vitest 2646 pass (+3) / smoke baseline winsA=498 不変・例外0 / cutin 回帰 (BUG-140, lensf-batch2b) green。

### 残 / 次アクション
- core(Task1-4)+BUG-151 は main 取込み済 (`1e3dcc80`)。学び: effect:declared は「カード使用」汎用 hook。
  kind/abilityId で必ず discriminate。pendingEffects は resolved を prune しない → UI は必ず state でフィルタ。

## セッション㉔ (2026-06-19) — Task5 FLIP 移動アニメ (CPU可視化機能 polish 完了)

commit `9facc5fa` (feat/task5-flip-anim → main FF-merge + push、CI run 27800793662 トリガー)。これで
「人間vsCPU 操作可視化 + 割り込みロック」機能セット (Task1-5 + BUG-151) **完了**。

### 実装 (engine 不変、UI 層のみ)
- 新規 `src/ui/hooks/useFlipAnimation.ts`: 現場カードの reflow (追加/除去/スイッチ/ゴースト消滅) を FLIP で
  移動トゥイーン。**MutationObserver(childList) 駆動** — 除去カードのゴースト消滅は SceneArea 内部 state で
  起きるため dep=gameState では捕捉不能。Observer なら全構造変化を捕捉。
- 補正: `.board-content` の CSS `zoom`(BUG-150) で差分を割る / sleep(rotate-90)・stun(rotate180)・pop(scale) の
  computed matrix を `translate(dx,dy) <matrix>` で合成し回転保持 / 回転に強い中心点計測。
- `SceneArea`: 実カードのみ `data-flip-id` (ゴーストは leave 専任で除外) / `Playmat`: boardRef + hook。
- スコープ確認済 = reflow 移動のみ。タップ横向き/登場ポップは既存 CSS で動作済 (調査で判明)。

### 検証
TDD 純関数 12 (rectCenter/computeFlipMoves: zoom補正/threshold/新規退場skip) / e2e 2
(`tests/e2e/task5-flip-reflow.spec.ts`: reflowスライド + **sleep回転保持の matrix合成** = 敵対レビュー指摘を実機で閉鎖) /
tsc 0 / vitest 2658 (+12) / 既存 scene・contact・reasoning e2e 6 回帰なし / lint errors=0。

### 学び (恒久)
FLIP under CSS `zoom` は差分を zoom で割る。CSS transform 持ちカードは computed matrix を合成 (translate 外側) して
clobber 回避。ゴースト等 React state 外のレイアウト変化を拾うには MutationObserver(childList) が dep より確実。
