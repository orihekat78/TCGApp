# 作業ログ — 名探偵コナンTCG プロジェクト

> memory.md は現セッション scratchpad。80 行超過時に `.claude/sessions/YYYY-MM-DD.md` へ退避。
> 過去ログ: `.claude/sessions/` (直近: 2026-06-01 = Phase17/BUG-085〜090 アーカイブ)

## 現在地 (2026-06-01)

- 直近 commit: bfb9c36 (BUG-089) → 7462ec8 (a2 inline) → 6eda0f2 (BUG-090) → b1e1bf3 (D11019 整形)。
- 事件カード a1/a2 と D11019 a1 を **DSL inline コンパクト形**に統一 (factory 非経由、byte 一致検証済)。
- 詳細な過去バグは `.claude/sessions/2026-06-01.md` + 各 `.claude/bugs/BUG-XXX.md`。

## 2026-06-01 BUG-091 — D11019 a1「公開した黄キャラが現場に登場しない」(user 報告)

- 症状: deckRevealUntil で matched しても sceneEnter が silent no-op → 登場せず (ログ matched=D11013 だが scene 空)。
- RCA: deckRevealUntil は `ctx.bindings['$matched']` ($込み) に格納するが、resolveBindRef は `value.slice(1,dot)='matched'` ($無し) で lookup → 未解決 `$matched.cardId` を返し sceneEnter が `startsWith('$')` で no-op。sceneEnter の uid write-back も同じキー不一致。
- キー規約混在: contact.ts は `'contact'` ($無し)、deck-reveal は `'$matched'/'$revealed'` ($込み)。
- 修正 (Workflow 4 agents で安全確定): resolveBindRef に $込みキー fallback (additive) + sceneEnter write-back を両キー対応。`$matched` 使用は D11019 のみ。
- 検証: unit 2件 (修正前 fail) + Playwright e2e (実機登場) / vitest **1649** / smoke 1000 exc0。詳細 `.claude/bugs/BUG-091.md`。

## 2026-06-01 BUG-092 + BUG-093 (修正済) — 突撃付与が無効 / 効果登場が名乗りにならない (user 報告)

- **BUG-093**: `sceneEnter`/`sceneSwitch` の既定が `named:false` → 効果登場キャラが名乗りにならず、突撃無しでも action 可能だった。既定を `named:true` に修正 (rules/06,17 効果登場も同ターン登場=名乗り)。D11019/D08024/D11014 影響。
- **BUG-092**: `read.char.keywords()` が `turnEffects['grantedKeywords']` (turn-scope 付与先) を読まず突撃4枚が空振り + `clearTurnEffects` が未呼出で turn-scope 効果が永続。keywords() に統合 + `flow/turn.ts endTurn` で両者 scene を `clearTurnEffects` 清掃。
- 連携: D11019 → 黄<20 で名乗り action[事件]不可 / 黄>=20 で突撃[事件] 効いて可 / turn 終了で解除。
- **突撃バッジ UI** (user 要望): SceneArea に名乗りバッジ同様の突撃バッジ (突/突キ/突事/迅) を追加。Playmat が `resolveKeywords={(uid)=>readChar.keywords(state,uid)}` を渡し、有効キーワードと CHARGE_BADGES を照合。`tests/e2e/charge-keyword-badge.spec.ts`。
- 検証: `D11019.charge-keyword.test.ts` 4件 / vitest **1653** / smoke 1000 exc0 (win 微変動=挙動修正)。詳細 `.claude/bugs/BUG-092.md` `BUG-093.md`。

## 2026-06-01 D11019 deck reveal UI 改善 (user 指摘 #1, 完了)

- DeckRevealOverlay (src/ui) を刷新: カード**画像** (CardArt) 表示 + reveal→toBottom(残りをデッキ下へ slide)→shuffle(山札シャッフル) の3フェーズ演出。`tests/e2e/deck-reveal-overlay-ui.spec.ts` で検証。`RealMatchView`/`Playmat` mount で meta も反映。

## 継続中の不変条件 (meta-app 作業)

- `src/` は meta-app 機能では import のみ (engine/UI バグ修正は例外として可)。
- Phase 11 統合経路保持 (`useGameStateStore` / `setGameState` / `customGameStart`)。meta-app は port 5174 独立。
- カード画像非同梱・公開ホスティング禁止 (法務スタンス)。tsc は `npx tsc --noEmit -p meta-app/tsconfig.json`。

## 持ち越し

- BUG-092 (turn-scope keyword read) / BUG-078 (effectPickResolve re-queue 未実装)。
- Phase 17+: 動的 unlock / クイズ / 章別練習シナリオ / バンドル分割。
