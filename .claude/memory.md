# 作業ログ — 名探偵コナンTCG プロジェクト

> memory.md は現セッション scratchpad。80 行超過時に `.claude/sessions/YYYY-MM-DD.md` へ退避。
> 過去ログ: `.claude/sessions/` (直近: 2026-06-03 = カットイン/ヒラメキ inline・全パートナー276枚・BUG-095)。

## 現在地 (2026-06-03)

- 直近 commit: 047df71 (全パートナー276枚) → 120d55c (apDelta 配線 設計) → (本コミット: BUG-095 実装)。
- **BUG-095 (完了)**: D08005 a1 デッドコード修正。`continuousModifier.apDelta`/`lpDelta` を engine 配線
  (read/char.ts `continuousDelta()` を ap()/lp() に合算) + dyn root `$self.faceUpEvidence` + `ContinuousDelta` 型。
  D08005 a1 を `{dyn:'$self.faceUpEvidence * 1000'}` 宣言形へ。詳細 `.claude/bugs/BUG-095.md`。
- 当日の他作業 (カットイン/ヒラメキ inline・全パートナー276枚) は `.claude/sessions/2026-06-03.md`。

## 2026-06-03 (3) MVP デッドコード監査 + BUG-096/097 (完了)

- MVP 47カードを6レンズ網羅監査。**verb/hook/cost/condition/dyn はクリーン** (全件コード照合)。
- **BUG-096**: triggered ability の `limit:{turn,n}` 未 enforcement (declared フローのみ)。triggered.ts で
  declaredUseCount 流用 enforcement。影響 D11016 a1 / D11007 a3。
- **BUG-097**: D11016 a1 が任意のガードで過剰発火 (matcher が card.uid 非参照)。Condition kind
  `guardedBySelf` 追加 + matcherCondition 化。
- 検証: vitest 1662 / smoke 502-498 exc0 / 新 test 4件 (triggered-limit-guard.test.ts)。commit 後に hash 記録。
- **⚠ 未対応 issue3**: D11007 a3 の `contactOpponentApHigher` も自己照合欠落 (contact aUid/bUid のみ見て自分を
  確認しない) → 任意 contact で過剰発火の疑い。attacker/defender どちら scope か rules 判断要 → user 確認待ち。

## 直近の重要知見 (継続参照)

- **triggered ability の limit**: declared と同じ `declaredUseCount` を triggered.ts でも enforcement (BUG-096)。
- **trigger 自己判定**: matcher closure は card.uid 非参照 → 自己照合は matcherCondition + ctx.source.uid で
  (guardedBySelf 等)。closure matcher だけでは「自分が〜したとき」を判定できない。

- **continuousModifier.apDelta/lpDelta**: engine read 時に ap()/lp() が走査・合算 (BUG-095 で配線)。
  dyn 宣言形推奨、`$self.ap`/`$self.lp` 参照禁止 (ap()→evalDyn→ap() 無限再帰)。
- **dyn root**: `$self.sceneTrait.<特徴>` (D08007) / `$self.faceUpEvidence` (D08005)。ctx.source.player ベース、uid 不要。
- **教訓**: shape-only test は dyn 未評価 runtime バグを見逃す → 数値効果は runtime オラクル必須。
  per-card test(隔離) は invariant/列挙回帰を見逃す → full suite + smoke 中央検証必須。

## 継続中の不変条件 (meta-app 作業)

- `src/` は meta-app 機能では import のみ (engine/UI バグ修正は例外として可)。
- Phase 11 統合経路保持 (`useGameStateStore` / `setGameState` / `customGameStart`)。meta-app は port 5174 独立。
- カード画像非同梱・公開ホスティング禁止 (法務スタンス)。tsc は `npx tsc --noEmit -p meta-app/tsconfig.json`。

## 持ち越し

- BUG-092 (turn-scope keyword read) / BUG-078 (effectPickResolve re-queue 未実装)。
- 全パートナー個別能力 ~22枚 (ct-p05/pr-01) は abilities:[] stub のまま (後日)。
- Phase 17+: 動的 unlock / クイズ / 章別練習シナリオ / バンドル分割。
