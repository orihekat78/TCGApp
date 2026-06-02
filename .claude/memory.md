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

## 2026-06-02 カード atom コンパクト化 + 規約制定 (完了)

- 規約2本制定: `card-authoring-convention.md` (1行atom/comment-above/短縮形優先/冗長choice除去) + `card-condition-catalog.md` (Condition.kind 早見表)。既存 doc 相互リンク。
- engine: 短縮形を `ATOM_PICK_SPEC` テーブル + `buildShortFormPick` に一本化 (動作不変 refactor)。新 PA 短縮形 sceneSetState/charModifyLP/sceneEnter(area) + dyn-delta。adversarial 3 lens で動作不変確認。
- 全 non-partner カードを comment-above 1行形に統一 (B0-B5)。冗長 choice→短縮形。partner (D08001/02,D11001/02)・`_shared/*` 対象外。
- **水平展開 (完了)**: 残る explicit `kind:'pick'` は全て正当 — D08021(multi-pick charStackCard) / D08026・D11021(dyn-delta 宣言能力=rule3例外) / D11014(bind:$entered) / `_shared/*`(対象外)。残 choice は D11012(真の2分岐)等。除去可能な冗長 pick は皆無。
- **教訓1**: dyn-delta(`delta:{dyn}`) 宣言能力を短縮形にすると AI 列挙時 costPaid 不在で dyn eval throw → explicit target 保持必須 (D11021 を explicit に戻して解消)。
- **教訓2**: 単一 option choice 除去は実行結果不変だが AI seeded 列挙木が変わり smoke 決着が 471/529→502/498 に動く (bisect で card 動作 byte 不変を確認)。
- **教訓3**: per-card test(隔離) は invariant/列挙回帰を見逃す → full suite + smoke 中央検証が必須 (workflow 並列 reformat の smoke 667 例外を中央検証で検出)。
- commit: 9f6e1be(規約) / 57a0f08・02695af・77630c1(engine) / 481d827(cards)。詳細 changelog 2026-06-02-01。

## 2026-06-02 (2) カットイン inline 化 + D08007 cutin バグ修正 (完了)

- **D08007 latent bug**: 「現場[少年探偵団]×1000 cutin」が実機で壊れていた。delta が bare string `'$dyn.shonentanteiCount*1000'` で resolveDynArgs ({dyn} object のみ評価) を通らず apMod_contact が文字列化→AP NaN。$dyn.shonentanteiCount も未 populate。shape test のみで見逃し (AI はカットイン未使用)。
- **engine fix**: dyn root `$self.sceneTrait.<特徴>` 追加 (ctx.source.player の現場特徴数を state 算出、uid 不在 cutin でも可)。`substituteAtomPick` 非 pick early-return でも `resolveDynArgs` 通す ({dyn} のみ変換=既存 atom no-op)。
- **D08007**: delta を `{dyn:'$self.sceneTrait.少年探偵団 * 1000'}` object 形へ + **runtime test** 追加 (apMod_contact===2000)。
- **cutin inline 化**: `cutinFixedAP` factory 廃止、6枚 (D08015/17/23, D11017/18/19) を inline atom 化 (D08007 同型)。factory .ts/.test/.md 削除、barrel/index.test/shared-classes INDEX 更新。e2e 6/6 PASS で挙動不変。
- 教訓: shape-only test は dyn 未評価 runtime バグを見逃す → 数値効果は runtime オラクル必須。
- **次 (user 要望)**: カットイン選択 UI を「手札拡大表示 UI 流用 + cutin 可能カードを黄色枠強調」に (テキストボタン廃止)。別途 brainstorm。

## 継続中の不変条件 (meta-app 作業)

- `src/` は meta-app 機能では import のみ (engine/UI バグ修正は例外として可)。
- Phase 11 統合経路保持 (`useGameStateStore` / `setGameState` / `customGameStart`)。meta-app は port 5174 独立。
- カード画像非同梱・公開ホスティング禁止 (法務スタンス)。tsc は `npx tsc --noEmit -p meta-app/tsconfig.json`。

## 持ち越し

- BUG-092 (turn-scope keyword read) / BUG-078 (effectPickResolve re-queue 未実装)。
- Phase 17+: 動的 unlock / クイズ / 章別練習シナリオ / バンドル分割。
