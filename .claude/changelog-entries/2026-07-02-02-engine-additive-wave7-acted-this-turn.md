# engine additive wave-7 (P17) — actedCharThisTurn TargetFilter 軸 + exemplar B08049 ジョディ

**Round/Phase**: 2026-07-02 engine-first フェーズ E1→E2 移行 wave-7。engine-extension-plan-2026-06-30 の
**P17 (acted-this-turn char filter)** を origin/main (8a4e6444) 実 grep で genuine-absent 確認後、structural 1 件を
**exemplar カード B08049 同梱**で出荷 (2026-07-02 速度リバランス方針: engine wave に生きた E2E test + clone 原器を同梱)。

## engine 拡張: P17 acted-this-turn char filter (structural、新 optional field + hot-path additive write)

「このターン中にアクション［キャラ］した」自軍キャラを per-char で記録し、TargetFilter で参照する軸。

1. **`actedCharThisTurn?: boolean` TargetFilter フィールド** — [effect.ts](../../src/engine/types/effect.ts)。board char のみ該当する
   軸 (deck/remove/hand の印字 candidate = c===null は「アクションした」概念が無く必ず不一致)。
2. **記録 (hot-path additive write)** — [state-machine.ts `declare`](../../src/engine/flow/action/state-machine.ts): `action:declare` emit 後、
   `target.kind==='char'` の時のみ actor へ `mutate.char.setTurnEffect('actedCharThisTurn', true)`。アクション[事件]
   (`target.kind==='case'`) では立てない。rules/22 に従い **宣言時点** (ガード判定前) で確定 — ガード有無・AP 判定結果・
   対象離脱による abort に依らず「アクションした」に該当。partner actor (`uid='partner:*'`) は `setTurnEffect` が findChar 不在で no-op。
3. **参照** — [candidates.ts `matchOneFilter`](../../src/engine/target/candidates.ts): `filter.actedCharThisTurn===true` の時、
   board char の `turnEffects['actedCharThisTurn']===true` を要求 (hasSetCards と同流儀の board-only 軸)。
4. **清掃** — [char.ts `clearTurnEffects('turn')`](../../src/engine/mutate/char.ts): 該当 flag を delete (ターン終了で失効)。
   `'action'`/`'contact'` scope では残す (同一ターン内、アクション終了後の【宣言】が候補列挙できるように)。
5. **3-way whitelist sync**: TargetFilter 型 + `FILTER_FIELDS` (validate-specs.cjs) + `TARGET_FILTER_KEYS` (sync-taskA-whitelists.test.ts)
   の 3 サイトに登録 (sync test が両方向強制)。ついでに **pre-existing sync 漏れ `colorNot`** も両サイトに追加し
   `satisfies Record<Exclude<keyof TargetFilter,'custom'>,true>` を honest 化 (runtime 比較は両 mirror が同集合ゆえ従来 green だったが型契約は不完全だった)。

## exemplar カード: B08049 ジョディ・スターリング (ct-p08、REUSE_CARDS)

- a1: 自分のターン終了時、自分の現場に〚特徴[FBI]〛が4枚以上いる場合、カードを1枚引く
  (`phase:end:start`+`turn:self` → conditional `sceneHas{trait:FBI, nMin:4}` → draw、既存機構、公式Q&A「解決時判定・自身も数える」)。
- a2: 【宣言】【ターン1】【スリープ】: 今ターン アクション[キャラ]した〚特徴[FBI]〛を1枚まで active化
  (`sleepSelf` cost + `sceneSetState{side:self, max:1, state:active, filter:{trait:FBI, actedCharThisTurn:true}}`)。← P17 初実利用。
- B08049P (RP clone、同効果) は card-wave へ (本 wave は exemplar 1 枚に focus)。

## 検証 (セルフレビュー + 水平展開 + opus 4-lens 敵対 review)

- **opus 4-lens 敵対 review (semantic / additivity / dsl-trap / edge-test) = 全 SHIP_WITH_NITS・blocker 0**。反映した nit:
  ① dsl-trap/semantic: `_shared.ts targetFilterToPredicate` は board-only 軸 (hasSetCards 前例) ゆえ actedCharThisTurn を
     コメントで「非対応」明記 (deck-path は c=null で評価不能、既存慣行と一致)。
  ② additivity: matchOneFilter を hasSetCards と同 `!== undefined` symmetric 化 (`false`=未アクション char 選択も honor) + false-case test。
  ③ edge-test: B08049 a2 の cost.canPay gate (active-only) + production `candidates()` による pick 候補 1対1 test を追加。
- tsc 0 (両 tsconfig) / vitest **3522 → 3537 pass** +1 skip (新規 15: filter honor 4 [true×3+false] / declare write 3 / reset scope 2 / B08049 exemplar 3 / a2 dispatch 2 [pick 候補 + cost gate])。
- smoke:1000 **winsA=498・winsB=502・timeouts/exceptions 0** = baseline 不変 (declare の新 write が全 1000 戦の全アクションで発火して 0 例外 =
  additive hot-path の実証。新 flag を読む既存 consumer が無いため候補列挙も不変)。
- 8 CI lint errors=0 (icon-abilities shipped 1509→1510 = B08049 登録)。
- playwright: 開発サーバ起動 → 対戦開始まで browser boot + game-init クリーン (favicon 404 のみ、game-logic error 0)。
  B08049 は MVP デッキ (CT-D08/D11) 未収録ゆえ in-app の 宣言 decoy は不可 → **production `candidates()` 経路を vitest #4 で
  decoy 込み 1対1 検証** (acted FBI のみ候補 / 未アクション FBI・acted 非FBI を除外) で BUG-117/118 の「DSL に書けても engine 評価保証なし」を担保。
- DEFER: boundDistinctColorCount (B07002 は distinct-color-pair + turn-scoped カットイン/変装 ban の 2-gate ゆえ本軸単独で 0 解禁) /
  P15 疾風 per-turn tracking (B09072/B09070 は推理不可付与・キーワード presence filter の第2 gate 併存で非 sole) は別 wave。

engine-extension-plan-2026-06-30 進捗: E1 additive 完了、**E2 structural 起点 (P17) 出荷**。
