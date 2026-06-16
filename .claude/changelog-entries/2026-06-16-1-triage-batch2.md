## トリアージ・スイープ 出荷バッチ#2 — window4 確定 green 4 + clone 4 = 8枚 (engine変更0、ALL_CARDS 1267→1275)

バッチ#1 (windows 1-3) に続き、window4 で certify+敵対verify 済みの確定 green **4 distinct rep** を
byte同一テキストの clone 4 枚と合わせて **8枚** 出荷。新 engine クラスタ不要 (既存 verb/hook/filter のみ)。

- **出荷カード**:
  - B01052 工藤優作 (+clone D06016): スリープ登場 +【登場時】デッキ1枚公開→lv6以下キャラなら登場/それ以外手札
  - B02025 遠山和葉 (+B02025P): 【相手ターン中】【現場リムーブ時】+【ヒラメキ】カットイン∧緑カードをリムーブエリアから回収
  - B04022 光本兵我 (+B04022P): 【相手ターン中】【現場リムーブ時】手札からlv4以下〚カード名［服部平次］〛をスリープ登場
  - B04031 中森青子 (+B04031P): 【宣言】【スリープ】〚カード名［黒羽快斗］〛にAP+1000 +〚突撃〛付与 (ターン終了時まで)
- **パイプライン** (バッチ#1 と同一): certify spec → `verify-clone-identity.cjs` (clone byte同一性、divergent 0) →
  `build-verified-codegen-input.cjs` (ADOPT 4 + clone 4) → `taskA-codegen.cjs --write` → `taskA-register.cjs`。
  出荷前に 4枚とも公式テキスト⇔spec を源泉 (TSV recs) で1対1再確認。
- **出荷除外** (window4 検証結果): B08023 は REFUTED (top-level choice 内の `uid:'$pick'+target` carrier が
  human 経路で continuation 喪失 → 2段目 silent no-op、実機 probe で確認)。spec as-written は fatal のため出荷せず
  (short-form carrier 書換で再挑戦余地)。D10003 は green だが needsManual (grantKeywords が JS closure) で別扱い。
- **gate5 実機挙動検証** (新規 `tests/cards/triage-greens-2026-06-16/` 4 files / **27 tests**): 4 distinct rep を
  すべて実 engine flow で発火 (enter hook / leave:to-remove / evidence:remove-by-action ヒラメキ / 宣言能力)、
  decoy (filter圏外カード) が影響を受けないことと負ケース (turn:opp 未達 / selfOnly / 0-pick / hirameki skip /
  declared cost / scope:turn 失効) を 1対1 assert。BUG-117/118 (型に書けても engine が評価しない) リスクを per-card に閉じた。
  カットイン decoy は icon-ability 正準形状 (keywords:[] 不使用、BUG-122)、服部平次 は split-name (rules/19) 正方向も検証。
  Workflow で opus エージェント 4並列 fan-out (1 workflow ずつ、rate-limit 回避)。

検証: validate-specs 8/8 pass (engine変更0) / tsc clean / **vitest 2431 pass (+27) 0 fail** /
smoke:1000 baseline 不変 (winsA=498, 0 exception) / playwright 回帰 119 pass / 規約 lint errors=0。
