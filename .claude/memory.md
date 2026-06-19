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
- **merge 未実施**: core(Task1-4)+fix の main 取込みはユーザー判断待ち (ff 可能、branch が main より 10 commit 先行)。
- **Task5 FLIP 移動アニメ** (polish、core と独立) は未着手。
- 学び: effect:declared は「カード使用」汎用 hook。kind/abilityId で必ず discriminate。pendingEffects は resolved を
  prune しない → UI は必ず state でフィルタ。可視化機能は無害な内部残留を表面化させる。
