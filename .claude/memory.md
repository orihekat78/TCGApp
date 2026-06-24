# memory — 現セッション scratchpad

## セッション54 (2026-06-23) — wave reveal-handadd (engine変更0、出荷10、cards/wave-reveal-handadd)

ユーザー選択: A「カード追加 継続」。reveal/deck-look→hand-add family を選定・実装。

**手法 (CLAUDE.md 決定論優先を徹底)**: 棚卸 signature tag は不可信を再実証 (col11/12 由来で col10 effect と無関係、
clean プールも hidden gate 混在)。**engine capability を agent 前にスクリプト grep で確定**:
- deckRevealUntil.filter = targetFilterToPredicate → defHasKeyword で keyword 印字判定 (変装=icon-disguise / 疾風=enterOrderEquals) + filterAny(OR) 対応
- sceneEnter source ∈ {hand,remove,deck} + filter (D07008/B01076) / mill は静的count (動的=DEFER) / caseTraitConditioned(continuous grantKeywords) で 【事件特徴】〚突撃〛
→ NEXT-SESSION の DEFER フラグ (B02050 keyword-filter / D10003 突撃+caseTrait) が **保守的すぎ=実装可** と判明 (capability-map stale 同型教訓)。

**ワークフロー**: ①author+verify (6 spec、opus pipeline) → 全 faithful+engineZero。②出荷ファイル直接の最終敵対review (6 lens)。

**出荷 10** (ALL_CARDS 1430→1440、engine変更0、手書き):
B02050 中森銀三 (reveal-until keyword変装) / B05114 弁崎桐平 (declared selfToDeckBottom cost + reveal-until cardNameバーボン) /
B05082+P 「FBI…」(event-use: reveal5 FBI→hand→remove→sceneEnter from hand) / B07010 円谷光彦 (reveal2 少年探偵団 + 解決編&加えた discard / 宣言 AP+3000) /
B09074+P+P2 松田陣平 (疾風 draw + reveal4 keyword疾風 + 加えた discard) / D10003+D10004 黒衣の騎士・スペイド (caseTrait突撃 + reveal-until cardName)。

**敵対 review が実バグ1件検出 (gate の真価)**: D10003/D10004 a1 inner.description が prefix 込み →
caseTraitConditioned 再付与で **二重prefix** (表示のみ)。inner.description から prefix 削除 (B07047/B07052 慣行) +
rules/24 追加 + 回帰防止 assertion で close。他 NIT は全非問題。

**検証 (全green)**: tsc0両 / vitest 2951→2969 (+18 decoy test) / smoke winsA=498 exc0 baselineOK (engine diff空が確証) /
e2e 123pass+1skip / 規約lint8本 errors0。decoy test = keyword[変装/疾風] は実能力持ち(D06012/D11003) match・stub decoy 非該当、
no-match over-fire guard、解決編/事件編 discard 分岐、caseTrait gate (read.char.keywords)、P版同一性。

**DEFER 据え置き**: PR265 (mill 動的count) / B09078 (dual-pick from one window) / B08026・B03028 (event-use closure/hook) / B04063 (動的level-sum)。

記録: changelog-entries/2026-06-23-10 / 教訓=NEXT-SESSION/capability-map の DEFER・⛔negative は engine 直grep で裏取り (stale 化しうる)。

## セッション55 (2026-06-23) — engine/mr-partner-area-core (rules/18 MR能力①② Phase1、branch=engine/mr-partner-area-core)

ユーザー選択: A「MR partner-area 実装 Phase1 engine core」。spec 2本を全読み→TDD (RED-GREEN)→4-lens 敵対review→fold-in。

**設計→実装の簡素化**: ①MR②×switch=3-caller 変更でなく switchEnter self-correct (freedSceneSlot、非MR完全不変) ②PA-MR reader=read.scene.byUid に sentinel 解決追加 (read.char.* uniform) ③candidates.ts 未変更 (targetability=DEFER) ④canDeclaredAbility に PA scope gate 追加。

**実装 (touched src/engine 10 file、additive)**: 新 slot partnerAreaMR (partner singleton 非破壊) / MR①=全 leave verb redirect (leave hook→redirect 順、dest から cardId 除去で refresh 単一計上、set は rules16 で remove) / MR②=applyMrEntryRemoval (cause:effect+noMrRedirect) / PA-MR reader spine (byUid/collectCardsInPlay/continuous±scope gate/flag/auto活性/declared) / isMR=rarity.startsWith('MR') / dead stub 2本削除。

**敵対review (opus 4-lens) = REVISE (BLOCK 無、rules lens=SHIP)**。fold-in: MAJOR-1=「byte-identical/MR0枚」claim 誤り訂正 (既登録 MR 5枚 B05066/B07079/B07093/B08032/B09054 は def.isMR=true で **MR①②有効化**、非MRのみ byte-identical) → 全 doc/card-comment 訂正。MAJOR-2=hook∧PA両立 test 追加。MINOR×4 (switch PA-slot test / set-stack per-verb + toDeckBottom set 欠落修正 + コメント訂正 / triggered scope decoy / canDeclaredAbility PA scope gate)。

**検証 (全green)**: tsc0両 / vitest 2969→2999 (+30 decoy、1skip) / smoke winsA=498 baselineOK (非MR=MVPデッキ) / e2e 123+1skip / eslint 0err。

**暫定保守解5件 + read/mutate非対称 = BUG-154**。残: Phase2=UI / 3=AI / 4=card wave SOLE 15。記録: changelog-entries/2026-06-23-11。

## セッション55 続 (2026-06-24) — A: Phase1 出荷 / E: 公式Q&A 照会 (branch=engine/mr-pa-qa-v2、worktree 経由)

ユーザー指示「A→E」。**A**: PR#3 を main へ rebase-merge (bef3adad、CI green)。**E**: deep-research workflow (verify は server rate-limit で全 fail) + firecrawl で commmune 事務局 Q&A 直接確認。
- **#1 MR① 中間状態 = 公式裁定あり** (post/2099836 事務局2025-10-08「リムーブエリアへ一度置かれてから PA へ移動 / リムーブ発動能力は発動 / デッキ下は【現場リムーブ時】非発火」) → 実装通り **確定**。
- **#3 PA-MR targetability = 公式裁定あり** (post/1690545 事務局2025-05-23「PA-MR の状態変更/移動は MR能力以外で不可」) → candidates 未変更 **確定**。
- **#2** 原則整合 / **#4** 公式裁定なし据え置き。
- **#5 修正**: 公式裁定なしだが rules/05①(活性化=パートナー+現場のみ)+事務局 sticky-state → **auto-phase の PA-MR 活性化を削除** (推測補完を撤回)。test も unchanged へ。記録=changelog 2026-06-24-01。
- ⚠ **並行 session collision**: engine/mr-partner-area-qa-followup を 2 session が共有 → 相手が c6e31c27 (越水/ラム 4枚) を commit + 私の作業を clobber。**git worktree (/c/tmp/mr-qa-wt、branch engine/mr-pa-qa-v2 off bef3adad) で隔離して commit**。教訓: 共有 working tree で別 branch 作業は worktree 必須。
