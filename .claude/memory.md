# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-15-5.md = セッション⑩⑪)

## 2026-06-16 セッション⑫ — トリアージ出荷バッチ#2 (window4 確定green 4 + clone 4 = 8枚)

正本 doc = [.claude/specs/triage-sweep-2026-06-15.md](specs/triage-sweep-2026-06-15.md)。
バッチ#1 (commit 7e3ce1de, ALL_CARDS 1267) を承けて window4 の確定 green を出荷。

### 出荷 (ALL_CARDS 1267→1275、engine変更0)

- window4 certify+verify 済の確定 green **4 distinct rep** + byte同一 clone 4 = **8枚**:
  - B01052 工藤優作 (+clone D06016): スリープ登場 + 【登場時】デッキ1枚公開→lv6以下キャラなら登場/それ以外手札
  - B02025 遠山和葉 (+B02025P): 【相手ターン中】【現場リムーブ時】+【ヒラメキ】カットイン∧緑カード回収
  - B04022 光本兵我 (+B04022P): 【相手ターン中】【現場リムーブ時】手札からlv4以下〚服部平次〛をスリープ登場
  - B04031 中森青子 (+B04031P): 【宣言】【スリープ】〚黒羽快斗〛にAP+1000+突撃付与
- パイプライン: certify spec (`.tmp/certify/{rep}.json`) → `verify-clone-identity.cjs` (divergent 0、clone 4 全 byte同一) →
  `build-verified-codegen-input.cjs` (ADOPT 4 + clone 4) → `taskA-codegen.cjs --write` → `taskA-register.cjs`。
- 出荷前に 4枚とも **公式テキスト⇔spec を源泉 (`.tmp/taskA/recs`) で1対1再確認** (精度優先)。

### 除外 (出荷しない window4 検証結果)

- **B08023 REFUTED** (verify ok:false): top-level multi-option choice 内の `uid:'$pick'+target` charSetCard carrier が
  human 経路で continuation 喪失 → 2段目 (AP/grant/sleep) が silent no-op (実機 probe で確認)。正解は short-form carrier。
  spec as-written は fatal → **出荷不可**。次回 spec 書換 (short-form) で再挑戦 or DEFER。
- **D10003** green だが needsManual (grantKeywords が JS closure、B07052 手写経 + case D10026 の caseTraits 要、BUG-124 family) → 別扱い。

### gate5 実機検証 (新規 `tests/cards/triage-greens-2026-06-16/` 4 files / **27 tests**)

- Workflow opus 4並列 (1 workflow、SUB throttle 内)。各 rep を実 engine flow で発火 (verb 直呼び無し):
  B01052=enter hook (handUseCard→enter) / B02025=removeToRemove→leave:to-remove + evidence:remove-by-action→hirameki /
  B04022=removeToRemove→leave:to-remove→from-hand sceneEnter / B04031=useDeclaredAbility (sleepSelf cost)。
- 全 filter を decoy で実評価実証 (BUG-117/118): カットイン decoy は icon-ability 正準形状 (keywords:[] 不使用、BUG-122)、
  服部平次 split-name (rules/19) 正方向 + level/kind/cardName decoy、黒羽快斗 vs 工藤新一 decoy。
  負ケース完備 (turn:opp 未達 / selfOnly / 0-pick / hirameki skip / declared cost negative / scope:turn 失効)。
- 4本とも自分で vitest 実走 + 直接精読でレビュー (anti-pattern 0、実 engine 駆動確認)。

### 検証 (全 green)

- validate-specs 8/8 (engine変更0) / tsc clean / **vitest 2431 pass (+27) 0 fail** /
  smoke:1000 baseline OK (winsA=498, exceptions=0) / playwright 回帰 **119 pass**。
- UI gate: 8枚は _reuse (MVPデッキ非搭載=手動プレイ不可)。playwright 119 が新カード込み実アプリ起動・走行、
  gate5 vitest が pick候補集合 (UI modal 描画元) を decoy で1対1検証 → batch#1 と同一プロセスで充足。

### 次セッション (段B / バッチ#3 候補)

- window4 残8 certify (B08033/B05027/B01057/B02031/B03056/B03079/PR263/PR099) → 新green収束 → バッチ#3。
- スイープ継続 (window5+、loop-until-dry) or 中型 engine クラスタ着手 (cutin-subtype 69枚 等)。
- B08023 short-form 書換 再挑戦も候補。

## 2026-06-16 セッション⑬ — トリアージ出荷バッチ#3 (window4 残8 certify → verified green B03079 + clone)

window4 残 8 rep を wf-certify (opus, SUB 8→5) → window4 **完全消化** (32 certified)。
verified-green は **B03079 のみ** + byte同一 clone B03079P = **2枚出荷** (ALL_CARDS 1275→1277、engine変更0)。

- **certify 結果 (残8)**: green 2 (B03056/B03079) / 敵対verify 通過 1 (B03079) / yellow 6。false-green 教訓再確認
  (決定論 green候補でも per-card certify 必須)。
- **B03079** (レイチェル・浅香 +P): a1【相手ターン中】【現場リムーブ時】deck-look3→【赤】1枚まで手札 (残デッキ下) +
  a2【ヒラメキ】sleep pick。a1 = D05007/D01013/B01013 certified-green 句の hybrid、a2 = D05007 a2 と byte同一。
  carrier `sceneSetState{uid:'$pick',target}` は resolve-picks Pattern A (BUG-130 非該当=単一atom)、B02019 gate5 で実証済。
- **gate5** (`tests/cards/triage-greens-2026-06-16/B03079.test.ts` / **7 tests**): a1 を `removeToRemove` 相手ターンで
  実発火し color:'赤' filter を decoy (青ev/青char) で実評価実証 + turn:opp/0-match 負ケース。a2 は
  `evidence:remove-by-action` 実発火→pendingHirameki surface 検証 + D05007 構造等価。
- **除外 (DEFERRED-INDEX 追記)**: B03056 REFUTED (**新規 gate: conditional-gated-optional surfacing** — conditional.then 内
  optional が if 評価前に eager surface、3枚未満でも証拠+自己リムーブ発火を verifier 実証)。yellow 6 = set-card-cost
  (B08033) / MR partner-area (B05027) / set-card→host (B01057/B02031) / partner-area (PR263) / name-designation (PR099)。
- **検証**: validate-specs 32/32 (engine変更0) / tsc clean / vitest 2438 pass (+7) / smoke baseline 不変 (winsA=498) /
  playwright 119 pass。commit → main ff-merge → push → CI。
- **次**: window5+ 新規抽出 (sweep-window2.cjs) → certify、or 中型 engine クラスタ (cutin-subtype 69 等)。
  scripts/wf-certify.mjs の SUB を 8→5 に恒久変更済 (memory throttle 教訓)。
