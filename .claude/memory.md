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
