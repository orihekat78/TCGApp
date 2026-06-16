## トリアージ・スイープ 出荷バッチ#4 — window5 certify → verified green 10 + clone 10 = 20枚 (engine変更0、ALL_CARDS 1277→1297)

fresh green候補 **20 rep** (package 横断層化抽出 / done 120 除外) を per-card certify (opus grounding→敵対 verify)。
green 13 / 敵対 verify 通過 11 → **gate5 実機テストで B05028 が BUG-111 を踏み追加 DEFER** → 出荷 **10 verified-green + byte同一 clone 10 = 20枚**。

- **出荷カード (10 reps + 各 clone)**:
  - B01065 沖矢昴 / B02038 怪盗キッド / B03031 大岡紅葉 / B05024 妃弁護士SOS(事件) / B07041 黒羽盗一 /
    B01076 「開けるんだキャメル…」(event) / B02041 怪盗キッド / B04051 宮野明美 / B07057 「時価4億円！」(event) / PR237 犯人
  - 句の構成は既存 certified-green exemplar の hybrid 再構成 (leave:to-remove×evidence-give×levelMax remove /
    disguise:into draw+contact AP / deckRevealUntil cardName×levelMin / case:to-resolved 共有 factory / 宣言 charSetCard /
    event-use enter-from-remove / enter+disguise sleep / 複数cardName reveal-until / optional{chain} grant / contact:start remove)。
- **パイプライン** (バッチ#1〜#3 と同一): certify spec → `verify-clone-identity.cjs` (clone byte同一性、divergent 0 / impl 0) →
  `build-verified-codegen-input.cjs` (ADOPT 11 + clone 11) → `taskA-codegen.cjs --write` → `taskA-register.cjs`。
  - **B05024 codegen 修正**: a1「事件が解決編になったとき手札1リムーブ」を codegen が closure matcher 文字列で出力 →
    validate-specs が `trigger.matcher closure forbidden` で検出 → 共有 factory `caseResolvedHandRemove({n:1})` (D09027 a1 と
    byte同一) へ手動差替えで解消。
- **certify 結果 (window5 20 rep)**: green 13 / 敵対 verify 通過 11 / refuted 2 (B09038/B09056) / yellow 7。
- **出荷除外 (DEFERRED-INDEX batch#4 節へ記録)**:
  - **B05028 gate5-defer (BUG-111)**: 宣言 a1 chain[charRemoveSetCard, sceneRemove] の「そうした場合」が **human-decline 経路**で破綻。
    set-card holder 在 + step1 を 0枚 decline すると step2 sceneRemove が**発火してしまう** (`applyPickSkipAndContinuation` が
    chain 残りを無条件実行、decline した charRemoveSetCard が `__chainStepNoApply` を立てない)。no-candidate 経路は正しく break するが
    **candidate在+decline** が壊れる。AI は greedy で decline せず仮面化 → **certify+敵対verify は見落とし、gate5 実機 decoy テストが検出**。
  - **B09038 refuted ×2 / B09056 refuted** (同 BUG-111): 0-pick decline 後の必須末尾 step (無条件 draw / 必須 choice) が continuation
    ごと drop。reorder は意味論非等価のため不可。
  - **yellow 7**: B04042 (レベル合計=aggregate-selection 制約) / B06032 (hirameki 経路の top-level optional skip) /
    B08038 (removed-by-this-effect 条件) / PR236 (distinct-name count) / B03033 (相手側数値 aura) / B06033 (hand→evidence verb) /
    B08050 (継続 self level 修飾)。いずれも既知/新規 STILL-OPEN gate。
- **gate5 実機挙動検証** (`tests/cards/triage-greens-2026-06-16/` に 10 新規 test / **計 142 tests green**、workflow で opus 11 並列 author):
  各 rep を実 engine flow (handUseCard / mutate.scene.removeToRemove / flow.contact.disguise / dispatchEngineAction hirameki /
  contact state-machine 等) で駆動し、全 filter (color/level/AP/trait/cardName/kind/keyword/side) に **decoy** を置いて 1対1 評価実証
  (BUG-117/118)。条件アイコン (turn:opp / partnerColor / caseStatus / fileAtLeast) は負ケース、「〜まで」は 0-pick 辞退路を検証。
  この decoy×human-decline 検証が **B05028 の BUG-111 を捕捉** — certify と敵対 verify をすり抜けた実バグを gate5 が止めた実例。

検証: validate-specs pass=45 fail=0 (engine変更0) / tsc clean / **vitest 2535 pass (+97) 0 fail** /
smoke:1000 baseline 不変 (winsA=498, avg=10.998, 0 exception) / playwright 回帰 119 pass (1 skip) / 規約 lint errors=0。
