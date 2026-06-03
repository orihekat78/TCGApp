# AUDIT 2026-06-03 — MVP カード Lens F 深掘り監査

MVP 複雑カード 15枚を1枚ずつ end-to-end 精査 (descriptor→engine→state)。**16 issue 確定**。
✅=Claude 個人確認済 / ◆=audit agent + empirical repro / ○=audit agent 確認 (未個人 re-trace)。
clean: D08003 / D08013 / D11015。未深掘り (簡易/factory): D08 cutin・partnerColorKeyword 系 (6レンズ sweep でクリーン)。

## 根本原因グループ

### A. declared ability の `condition` が engine 未評価 ✅ [HIGH]
`canDeclaredAbility` (declared-ability.ts:76) は対象存在+`limit` のみ判定し `ability.condition` を evalCond しない。triggered は発火 gate 済だが declared は未配線 (BUG-067 の積み残し)。
- **D08026 a2**: 【解決編】gate が効かず事件編で宣言可。
- **D11003 a2**: 【婚活】AND 警察≥2 gate が効かず常時宣言可。
- **D11021 a2**: 【解決編】AND 神奈川県警≥1 gate が効かず常時宣言可。

### B. 疾風 closure matcher が累積 `enterOrder` 参照 ✅ [HIGH]
`matcher:(p)=>p.enterOrder===1` は累積 scene 位置を見る。turn-local `enterOrderThisTurn` (=matcherCondition `enterOrderEquals`、D11014 が正) が正解。現場残存キャラで誤判定 (false-neg / 後で誤発火)。
- **D11003 a1** / **D11009 a2**。

### C. `sequence` が pick で pause しない ○ [HIGH]
resolver.ts の `sequence` は全 step を同期実行 (chain のような pending-pick pause/継続なし)。pick を含む step の後段が **pick 解決前の盤面**で評価/候補列挙される。
- **D08024 a1**: step2 AP+2000 の対象に step1 登場キャラが入らない。
- **D11014 a2**: step3「萩原千速登場なら1ドロー」(boundMatchesFilter $entered) が pick 前評価で不発 (human/AI 両方)。
- **D11020 a1**: step2 removeTraitAtLeast が step1 除去前に評価 + step2 候補に step1 対象が残る。

### D. AI/CPU 経路で multi-pick が未解決 ◆ [HIGH]
- **D08021 a1**: `charStackCard` の `cardIds:'$pick.cardIds'` が AI 経路 (resolve-picks heuristic + chooseAtomTarget) で解決されず silent no-op → `stackedCards=0` → a2 突撃 / a3 draw / a4 evidenceGain が全て unlock されず CPU の D08021 がバニラ化。cardIds 解決は human modal (useEngineDispatch) のみ。empirical repro で stackedCards=0 確認。

### E. `choice` の choiceIndex が未配線 ○ [HIGH]
- **D11012 a1**: `choice` は `ctx.dyn.choiceIndex` のみで分岐するが production の人間/AI どちらも choiceIndex を set しない → 常に option0 (LP+1)。option1 (AP+2000) が到達不能。

### F. D11013 カットイン ○ [HIGH/MED]
- **a1**: custom check が `ctx.contact?.targetUid` 参照だが entryToCtx が `ctx.contact` 未設定 → 「[警察]に当てたら1ドロー」が永久不発 (AP+1000 のみ適用)。
- **a1**: `$contact.byUid` が常に攻撃者 → 【自分ターン】制限が無い D11013 を相手ターンに防御側カットインすると相手の攻撃キャラを AP+1000 してしまう。

### G. D11005 挑発 (mustBeTargeted) ✅ [HIGH/MED]
- **a2**: `charSetTurnEffect` に `value:true` を渡すが handler は `a.val` を読む (atom-handlers.ts:658) → `mustBeTargeted=undefined` で dead-code (apDelta と同型の key 不一致)。
- **a2**: `scope:'opp-turn'` を handler が無視 + `clearTurnEffects` が mustBeTargeted を消さない → 修正しても永続化。

### H. D11019 deck reveal 複製 ○ [HIGH]
- **a1**: マッチ黄キャラの `sceneEnter($matched.cardId)` に source pick-query (target) が無く deck-splice 分岐が走らない + `$revealed` が matched を除外 → 登場後もデッキに残り**現場+デッキで複製**。

## 修正状況

- **✅ バッチ1 修正済 (2026-06-03)**: A=BUG-099 / B=BUG-100 / G=BUG-101 (個人確認済3グループ)。
- **✅ バッチ2a 修正済 (2026-06-03)**: H=BUG-102 (D11019 deck splice) / D=BUG-103 (D08021 AI multi-pick、empirical 確認)。
- **✅ バッチ2b 修正済 (2026-06-03)**: F=BUG-104 (D11013 防御側カットイン: ctx.contact + byUid per-player、empirical 確認)。
- **✅ バッチ2c 一部修正 (2026-06-03)**: C=BUG-105 (resolver sequence pick-pause)。D08024/D11020 (state 依存) 修正、
  D08013/BUG-078 保護 (Phase F 更新)。D11014 は bind 依存のため部分 (⚠ 下記継続)。
- **⏳ 継続課題**: D11014 の `$entered` bind が pick-resolve 越しに伝播しない / AI 経路の side-channel pick drain
  (D08021 と同根、単一 PB pick が AI で no-op) / **E (D11012 choiceIndex 未配線)**。

## 次アクション

- 残り C/D/E/F/H を各々個人 re-trace → BUG-XXX 昇格 → 修正。
- enforcement gap A/B/C は [card-condition-catalog.md](../specs/card-condition-catalog.md) ⚠節にも記載済。
- 詳細 (file:line・empirical repro): workflow 出力 `tasks/wi0i16z50.output`。
