## トリアージ・スイープ 出荷バッチ#1 — certify確定 green 56枚 (engine変更0、ALL_CARDS 1211→1267)

トリアージ・スイープ (windows 1-3) で certify+敵対verify 済みの確定 green 25 distinct rep を、
byte同一テキストの clone 31枚と合わせて **56枚** 出荷。新 engine クラスタ不要 (既存 verb/hook/filter のみ)。

- **clone 安全弁** (新規 `scripts/survey/verify-clone-identity.cjs`): sweep の signature() は色/数値/特徴を
  抽象化する lossy 関数のため cloneTargets は同型でも別テキストの可能性がある (card-wave SKILL §2 警告)。
  各 clone の effect/cutIn/hirameki/henso を rep と byte 比較し **同一のみ採用** → divergent 7枚を正しく除外
  (B05016 小嶋元太 (of B03086 伊達航) 等、別キャラ別テキスト)。31 identical (大半パラレル + PR080/D10020/D09020/PR170 等真の再録)。
- **codegen バグ修正** (`scripts/taskA-codegen.cjs`): certify spec が ability-level ruleRefs を欠く (top-level のみ)
  場合、生成 ability に ruleRefs が落ち reuse-batch.test「全 ability に ruleRefs」が fail。欠如時に card-level を
  fallback 注入するよう修正。
- **DEFER 解除**: B07098/P (キャンティ) は「remove-area keyword-count dyn 不在」で defer 済みだったが、
  count-dyn ではなく `forEach over:{all, query:{area:'remove', filter:{keyword:'カットイン', color:'黒'}}}` で
  per-card AP+1000 = ゲートを正当回避。engine `target/candidates.ts:160` (remove 列挙) + color/keyword filter (BUG-122)
  が honor することを静的確認 + runtime decoy test 44 assertions で実証。DEFERRED-INDEX を解禁マークに更新。
  `build-verified-codegen-input.cjs` に DEFER 照合ガードを追加 (将来の deferred カード出荷を surface)。
- **gate5 実機挙動検証** (新規 `tests/cards/triage-greens-2026-06-15/` 25 files / **172 tests**): 25 distinct rep
  すべてを実 engine flow で発火し、decoy (filter圏外カード) が影響を受けないことと負ケース (optional しない / 0-pick /
  条件未達) を 1対1 assert。BUG-117/118 (型に書けても engine が評価しない) リスクを per-card に閉じた。Workflow で
  opus エージェント fan-out (SUB=5 throttle、敵対的)。

検証: validate-specs 56/56 pass (engine変更0) / tsc clean / **vitest 2404 pass (+172) 0 fail** /
smoke:1000 baseline 不変 (winsA=498, 0 exception) / playwright 回帰 119 pass / 規約 lint 9本 errors=0。
