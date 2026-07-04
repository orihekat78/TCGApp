# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-07-03-megawave.md](sessions/2026-07-03-megawave.md)。

## 2026-07-04 engine mega-wave W5 (dyn/cost、worktree C:/tmp/megaw1 branch engine/mega-w5)

- **W5 出荷**: r38 evidenceFlip multi (cardIds契約)+bind+dyn-max / r47 levelIn+levelInBound+deckRevealUntil dispatch-time dyn filter / r37 removeDeckTop.n dyn / 統合 $bound.<key>.count/level/cardName dyn root + resolveDynNumber (dyn/eval.ts、cost層の層違反回避)。exemplar B08028・B04074/P・B04088/P (5 printings、全列突合)。
- **DEFER**: r43 self-latch (設計wf自身が推奨、T3/sole1枚/touched6+) / B09109 (a2 P12 charSetName 不在。a1 は全部品出荷済 — spec の「rider不在」主張は偽 = toDeckBottomOnTurnEnd は B07079/PR181 既出荷、W4 教訓「設計spec 着手時再裁定」の再現)。
- **混成 review**: sonnet5 SHIP / opus SHIP_WITH_NITS、blocker 0、lens 割れ無し (fable 不要)。nit 即対応 = levelInBound fail-closed guard (matchOneFilter+targetFilterToPredicate) + 解決clone から levelInBound 除去 + negctrl assertion 厳密化。latent nits = DEFERRED-INDEX「megaw5」節。
- **教訓**: TargetFilter 追加は 3-way sync (型 / FILTER_FIELDS / **sync-taskA-whitelists.test.ts の TARGET_FILTER_KEYS literal**) — 第3点忘れで full vitest 1 fail。/ short-form (dispatch-time) pick は sequence でも bind が次 atom より先に確定 (AI/human 実測 pin、「chain 必須」は eager pre-walk 形のみ)。/ r49/r54 (P14) は $bound で実質被覆。
- ゲート: tsc0 / vitest **3975+1skip** (+35) / smoke winsA=472 不変 exc0 / 8lint err0 / docs 汚染0。playwright = 非MVPデッキカードのため N/A (B05013 同 posture、human経路は vitest applyPickAndContinuation 実測)。
- **W6 設計 workflow を背景並列で実行** (sonnet5 grounding+design ×11 unit + opus synthesis、read-only worktree C:/tmp/w6ro)。

## 2026-07-04 engine mega-wave W6 前半 (structural step1-6、worktree C:/tmp/megaw1 branch engine/mega-w6)

- **W6a 出荷 (origin 68f61221)**: step1 declareName 統合 / step2 resolveBindRef merge + nameOverride 完全置換 / step3 useEventFromHand+eventUseSource / step4 疾風 3軸 (per-char flag + waive) / step5 untargetableByActionAura + noAutoActivate lock + stunAutoActivate partner-bearer / step6 selectedByOwnMr dual-path。engine-only、probe 60 tests。
- **混成 review**: sonnet5 BLOCK / opus SHIP_WITH_NITS → **fable 裁定 SHIP_WITH_NITS** (nameOverride honor 欠落 = latent 降格 → effectiveNameComponents 修正 + probe 3件即対応、useEventFromHand kind guard も)。残 nits = DEFERRED-INDEX「megaw6」節。
- ゲート: tsc 両0 / vitest **4035+1skip** (+60) / smoke winsA=472 不変 exc0 / 8lint err0 / CI green。
- 教訓: scene.byUid 不在=null (truthy判定) / Pattern A atom は walk 前提 (直接 runEffect で $pick no-op) / shell cwd 永続 → worktree 作業中の cd は絶対 path 徹底 / 新 name 機構は names() + effectiveNameComponents 両 honor (BUG-117)。
- 次 = W6 後半 (step7-11) + step12 card-phase。

## 2026-07-04 朝 session: mega-wave W6 後半 (step7-11) 出荷 → engine 骨格凍結到達
- **W6b 出荷 (origin af5b580c = feat 8beaf75a + fix d65076e5 + docs)**: step7 evidenceGainSuppress + hirameki defer 再順序化 (B02088/B03126) / step8 GameState.reservedEffects queue (B08069/B01058) / step9 startContact 本実装 + generatedByEffect (B06020/B06042) / step10 leave:intercept pre-splice consult AI-only (B01092/B01039) / step11 hand-declared gate + findDeclaredAbility rider + removeAreaToDeckTop (B07014 full 解禁)。engine-only、probe 32 tests。
- **混成 review**: sonnet5 SHIP / opus SHIP_WITH_NITS、**blocker 0・split なし (fable 不要)**。opus NIT phantom 手札 guard 即修正。nits = DEFERRED-INDEX「megaw6b」節 (human-defender window LOUD DEFER 最重要)。
- ゲート: tsc 両0 / vitest **4067+1skip** (+32) / smoke winsA=472 不変 exc0 / 8lint err0 (side-channel allowlist に ContactStartAxId 追加)。
- 教訓: (1) hirameki は scope 'on-evidence' (probe def の on-scene は listener 素通り) (2) PA短縮形の候補 state filter は query.state **配列** (a.state scalar は to-state — filter は明示 PB target で書く) (3) reservedEffects 発火の AI pick は drainAiEffectPicks 必須 (4) canDeclaredAbility fail-closed 化は pin 3 file 更新を伴う挙動変更 — 既存 pin grep が先 (W4 教訓の再確認)。
- **次 = step12 CARD PHASE 一括刈り取り** (engine 凍結、B01092 の human-defender window のみ残 engine 必須 touch-up)。

## 2026-07-04 (session: CARD PHASE step12 batch1)
- **出荷**: mega-wave 解禁 consumer **15枚** (B04072/B03046/B08014/B09090/B01058/B08069/B03126/B02088/B07026/B05042/B08026/D10005/B07014/B01039/B09070) + **BUG-170 修正** (履歴 flag selectedByOwnMr・shippuFiredCharThisTurn の清掃を endTurn→startTurn 境界へ。B08014/B09070 の印字条件が常に空振りする race を first-consumer probe が検出)。
- grounding = sonnet5 workflow 22 card (⚠ 22 並列は rate-limit 全滅 → **chunk 4 並列で再走**、memory 警告の実証)。probe = tests/cards/step12-batch1.test.ts 49+3 tests。
- DEFER: B06020 (hand-scope aura 不在) / B06042 (charGrantAbility declared 経路 3 gap) / B06085 (evidenceGain faceUp 軽微 additive) / B09112 (pre-walk dyn literal 化、実測) / B09108+PR105+B09003 (DeclareCardNameModal 配線待ち = **batch2**)。詳細 DEFERRED-INDEX「step12-batch1」節。
- 教訓: (1) **lint:icon-abilities が B09070 の cutIn 列実装漏れを検出** — grounding 通過後も col11/12/13 は lint が最終防波堤 (2) canDeclaredAbility/useDeclaredAbility は (state, uid, abilId) — player 引数なし (3) charGrantKeyword 短縮形は player 必須 (charModifyAP と非対称) (4) caseTrait cond は CardDef.caseTraits 読み (state.case.traits でない) (5) useDeclaredAbility は cost を支払わない (caller が pay 先行) (6) 「〜まで」持続効果 = endTurn 清掃 / 「このターン中に〜した」履歴 = startTurn 清掃 (BUG-170 区別基準)。
- playwright 実機は未実施 → batch2 冒頭で一括 (hirameki suppress / useEventFromHand / rider / reserve / 候補除外 UI)。

## 2026-07-04 (追記: Track B B4 param rules)
- ユーザー指示「ツールでカード実装できないか」→ **B4 parametric rule 出荷** (slot 汎化 + 共変 path 積集合、refuse-first 維持)。re-mine で exact rule 4→717、param 569 本、G1 mismatch 0 (partial-shipped 4枚は exceptions 自動登録)。
- **実測: 自動 compile 可 = 15→22/482 のみ** — ボトルネックは slot 値でなく句の構造多様性。**near-miss (未知 1 行だけ) = 205/482** が最大レバー → hybrid pipeline (compiler N-1 行 + agent 1 行) を次設計。
- compile 可 22 枚 (B04093 コルン含む) は codegen T0 batch 候補 (.tmp/compiler/param-compilable.json)。

## 2026-07-04 昼 CARD PHASE step12 batch2 (worktree C:/tmp/megaw1 branch cards/step12-batch2)
- **出荷**: declareName family 5 printings (B09108/P MR・B09003/P・PR105) + DeclareCardNameModal 配線
  (useDeclareNamePicker + Playmat mount + flows 3.8 + findDeclareNameAtom、optional=skip ボタン)。
- **BUG-171 (engine 骨格修正)**: entry.dyn queue 永続化 (costPaid 同型) + charSetTurnEffect '$' guard。
  W6 probe は runAtom 直駆動で queue 境界未踏 → first-consumer の production 経路 probe が検出
  (obs 13661 が 6/15 に同 gap 指摘済だった)。教訓 = probe は activateDeclaredAbility+runAllUntilEmpty で。
- **BUG-172 (UI)**: 宣言 2 つ持ちの ability 択 picker にクリック面なし = human hang → ChoicePickerModal 差替
  (既出荷 B05028/B05045/B06069 の latent も解消)。**BUG-173 (UI)**: interactionLock が resolved 残留で
  永久ロック → pending|resolving filter (BUG-151 規約)。両方 playwright 実機で発見。
- **batch1 playwright 一括実施済** (suppress+non-suppress ヒラメキ/B01058 reserve pick/B07014 rider/
  B05042 useEventFromHand decoy 検証/B04072 候補除外)。DEFERRED-INDEX batch1 (3) ✅。
- DEFER: B09108 PA 発 human 宣言 UI (PA-MR 描画すら無し) = PA宣言19 batch へ / rider description fallback /
  conditional×boundNameMatchesDeclared then 内は短縮形 pick のみ規約 (DEFERRED-INDEX batch2 節)。
- gates: vitest 4130+1skip / smoke 472 exc0 / 8lint0 / 混成 review sonnet5+opus。
