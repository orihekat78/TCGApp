# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-16.md = セッション⑫⑬)

## 2026-06-16 セッション⑭ — トリアージ出荷バッチ#4 (window5 certify → verified green 10 + clone 10 = 20枚)

正本 doc = [.claude/specs/triage-sweep-2026-06-15.md](specs/triage-sweep-2026-06-15.md)。
fresh green候補 **20 rep** (greenN=20 package横断層化, done 120 除外) を wf-certify (opus, SUB=5)。

### certify 結果 (window5 20 rep): green 13 / 敵対verify 通過 11 / refuted 2 / yellow 7

### 出荷 (ALL_CARDS 1277→1297、engine変更0) — verified-green 10 + clone 10 = 20枚

- B01065 沖矢昴 / B02038 怪盗キッド / B03031 大岡紅葉 / B05024 妃弁護士SOS(事件) / B07041 黒羽盗一 /
  B01076 開けるんだキャメル(ev) / B02041 怪盗キッド / B04051 宮野明美 / B07057 時価4億円(ev) / PR237 犯人 (+各clone)
- パイプライン: certify→`verify-clone-identity.cjs`(divergent0/impl0)→`build-verified-codegen-input.cjs`(ADOPT11+clone11)→
  `taskA-codegen.cjs --write`→`taskA-register.cjs`。
- **B05024 codegen 修正**: a1「解決編→手札1リムーブ」が closure matcher 文字列で出力→validate-specs `trigger.matcher closure forbidden`
  検出→共有 factory `caseResolvedHandRemove({n:1})` (D09027 a1 byte同一) へ手動差替えで解消。

### gate5 で B05028 の BUG-111 を捕捉 → 追加 DEFER (11→10 出荷)

- gate5 workflow (opus 11並列, SUB=5, `scripts/wf-gate5-batch4.mjs`) が `tests/cards/triage-greens-2026-06-16/` に 10 新規 test (計142 green)。
- **B05028 (服部平蔵)**: 宣言 a1 chain[charRemoveSetCard, sceneRemove]「そうした場合」が **candidate在+human-decline**
  で破綻 — step1 を0枚 decline しても step2 sceneRemove が発火 (`applyPickSkipAndContinuation` が無条件継続、decline した
  charRemoveSetCard が `__chainStepNoApply` 非設定)。no-candidate 路は正しく break。AI greedy で仮面化。
  **certify+敵対verify すり抜け、gate5 実機 decoy が検出** → B05028/P de-register + .ts/.test 削除。
- 教訓: chain「そうした場合」の **no-candidate break は正常だが candidate在+human-decline は壊れる** (BUG-111)。
  この型 (declared/optional の 0-pick 後に chain/必須末尾) は gate5 で human-decline 路を必ず踏む。私の事前決定論分析は
  「decline→break」と誤断 (break は no-candidate のみ) → gate5 実機が訂正した実例。

### 除外 (DEFERRED-INDEX batch#4 節)

- refuted: B09038 (再×2, BUG-111 無条件draw drop) / B09056 (BUG-111 必須choice drop) — 全 BUG-111。reorder は意味論非等価で不可。
- yellow 7: B04042(sum制約)/B06032(hirameki top-optional skip)/B08038(removed-by-this-effect)/PR236(distinct-name count)/
  B03033(相手side aura)/B06033(hand→evidence verb)/B08050(継続self level)。

### 検証 (全green)
- validate-specs pass=45 fail=0 (engine変更0) / tsc clean / **vitest 2535 pass (+97)** / smoke baseline 不変 (winsA=498,avg10.998,0exc) /
  e2e 119 pass。commit→push→CI。

### 次セッション
- window6+ 抽出 (`sweep-window2.cjs <greenN>`) → certify → バッチ#5、or 中型 engine クラスタ着手
  (cutin-subtype 69 / grant-textual 50 / contact-removal-by-self 39 / **BUG-111 修正で chain-decline 系を解禁**)。
