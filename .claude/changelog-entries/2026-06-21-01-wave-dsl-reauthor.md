# カード追加 wave — DSL 再author (engine 変更 0、3枚/5刷)

**Round/Phase**: 2026-06-21 カード追加 wave。standing green queue 枯渇 (taskA-next-chunk=[]) のため、
DEFERRED-INDEX の **DSL-fix 系 refuted** (engine変更0 で再author 可能) を再評価して出荷。過去に refuted された
3 rep を「既知 fix + 全句 grounding」で再author → 敵対verify (opus 6/6 ship) + decoy 28 pass で出荷。

## 追加カード (3 rep / 5 刷、ALL_CARDS 1357 → 1362)

- **B02026 綾小路文麿** (緑 L5 AP5000 LP1 警察|京都府警、C):
  - a1【ターン1】相手の現場にいるキャラがアクションしたとき、カードを1枚引く。= **action:declare 観測者**
    `trigger{hook:'action:declare'}` (NOT selfOnly) + `condition triggerCharMatches{side:'opp', filter:{}}` + `limit turn1` + `draw1`。
    **旧 refuted の真因**: `triggerCharMatches{side:'opp'}` が filter フィールド無で相手 partner のアクションでも誤発火。
    **fix**: 空 `filter:{}` を付与 — eval.ts:298 は filter 存在時 (空 {} も JS truthy) のみ scene 走査するため、
    partner-area の partner を除外し「現場にいるキャラ」を厳密充足 (kind:character は不要)。exemplar B03097/B02012。
    「アクション」種別無 → triggerActionKind gate 無し ([キャラ]/[事件] 両方発火)。
  - a2【ヒラメキ】カードを1枚引く = `triggered/on-evidence/{hook:'evidence:remove-by-action',optional:true}/draw1` (D01006 a3 verbatim)。
- **B04004 / B04004P 毛利蘭** (青 L8 AP8000 LP0 高校生|毛利探偵事務所|空手家、SR/SRP):
  - a1【パートナー青】〚迅速〛 = `partnerColorKeyword({color:'青',kw:'迅速'})` (_shared、D02003 verbatim)。
  - a2【ターン1】相手キャラがこのキャラとのコンタクトでリムーブ時、手札1リムーブしてもよい→そうした場合 証拠1 =
    cluster15 `trigger{leave:to-remove}` + `removedCharMatches{side:opp,cause:contact-ap,by:self}` (B09071 a3 verbatim) +
    `chain[discard{max:1}, evidenceGain{n:1}]` (B04056 同型)。
  - a3【絆工藤新一】【ターン1】相手キャラが自分の工藤新一を指定してアクション時、このキャラをアクティブにする。
    **旧 refuted の真因**: actor-gate 欠落で相手の任意アクションに誤発火。**fix**: `matcherCondition and[`
    `triggerCharMatches{side:opp,filter:{}}` (actor=相手現場、B01062 pattern)`, triggerCharMatches{payloadKey:'targetUid',side:self,filter:{cardName:工藤新一}}` (target=自分の工藤新一、B08048 verbatim)`]`
    + `condition bond{工藤新一}` + `sceneSetState{$self,active}`。action:declare payload の targetUid (char target時 flat併記、state-machine.ts:198) を読む。
- **B09097 / B09097P コルン** (黒 L4 AP4000 LP0 黒ずくめの組織、C/CP):
  - 【事件赤＆黒】【事件編】【登場時】手札から赤/黒1リムーブしてもよい→そうした場合 2枚引く→この効果でL7+リムーブなら相手deck上3リムーブ =
    `condition and[caseColor{[赤,黒],combine:and}, caseStatus{事件編}]` + `trigger{enter,selfOnly}` +
    `chain[discard{max:1,filter:{color:[赤,黒]},bind:$removed}, draw{n:2}, conditional{boundMatchesFilter{$removed,levelMin:7}→mill{opp,3}}]`。
    **旧 refuted の真因**: bare-chain で「CPU 強制 discard 化」。**fix**: shipped twin B04056/D08003 と同じ `discard{max:1}`(min:0=decline可)
    で再author (DEFER note の optional ラップは不要 — 敵対verify が「AI-policy divergence only / 有益効果の greedy-accept は妥当」と nit-ship 判定)。
    「カード」= kind filter 無で赤/黒イベントも対象。mill は deck枯渇 refresh/deck-out 処理済 (BUG-137、Q&A② 充足)。

## 検証

- **engine 変更 0 確証**: `git diff` で src/engine/・src/cards/_shared/ に変更なし (= registry + 新カード + テストのみ)。
  validate-specs pass (B02026/B09097 JSON-expressible / B04004 は partnerColorKeyword closure ゆえ MANUAL = shipped B06038/B09071 と同カテゴリ)。tsc clean。
- vitest full 2686 pass (baseline 一致、減なし)。smoke:1000 exceptions=0・baseline 不変 (avg11/winsA498)。e2e 120pass/1skip
  (1 fail = `spectator-speed.spec.ts` の pre-existing UI timing、registry revert でも再現 = 本 wave 無関係)。
- 新規 `tests/cards/wave-dsl-reauthor.test.ts` 28 件: decoy を盤面/手札/デッキに置き全 filter/gate を実 engine 経路で 1対1 検証
  (B02026 partner除外 / B04004 actor+target AND gate + removedCharMatches 4-leg / B09097 caseColor AND + L7境界 + event含む + decline→chain break)。
- **敵対verify (opus、過剰発火 lens + 語義fidelity lens、計6)**: 6/6 ship・refuted 0・allShip=true。
  指摘は全て nit (NOT A DEFECT / CORRECT の確認)。B09097 の bare-chain は「frozen-engine convention 一致」と確認。
