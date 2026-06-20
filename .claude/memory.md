# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-19-3.md = ㉖ / 2026-06-21.md = ㉗。)

## セッション㉘ (2026-06-21) — engine拡張 micro-cluster: distinct-name-count (4刷)

ユーザー選択=カード追加 wave 継続 (A)。但し A=engine変更0 残弾尽きを **決定論スキャン**で確証してから着手。
`taskA-next-chunk`=[] (standing green 枯渇) + `.tmp/gate-yield-scan.cjs` で未実装 685 cardNum を実テキスト走査 →
単一 additive gate の最大実 yield=3-5 base と判明 (handoff「生産性尽きた」をハードデータで裏付け)。
ユーザーに実数提示し「小型 additive バッチ」選択 → skill 規律「engine拡張は混ぜない/1phase=1commit」に従い
最クリーン単一 **distinct-name-count** に絞って出荷。

### engine 変更 (1分岐、純 additive — 骨格解凍だが破壊変更なし)
`src/engine/cond/eval.ts` の `case 'sceneHas'` に `query.distinctNames` honor 分岐追加。一致候補を
`def.names[0]` (印字名) で dedupe して計数。**TargetQuery.distinctNames は既存 flag** (従来 pick-resolve のみ honor、
sceneHas 計数では無視) → 新 Condition kind 無 = union/CONDITION_KIND_MAP/validate CONDS 同期不要。

### 出荷 (ALL_CARDS 1362→1366)
- **B08067/B08067P 諸伏高明** (黄L5): triggered{enter,selfOnly}+condition and[partnerColor黄,caseStatus解決編]+
  effect conditional{if: sceneHas{distinctNames,trait:長野県警,nMin:3,side:self}→sceneRemove{max1,either,levelMax7}}。
  自己包含 (excludeSelf無=qAndA)。exemplar D08003 a2 + PR101。
- **PR236/PR242 大和敢助** (黄L7、byte同一): a1 declared+limit turn1+cost sleepSelf(【スリープ】=rules/21 コロン左)+
  sceneRemove{apMax5000,state:['sleep']} (B09006 a1 byte一致) / a2 同cost+**宣言ゲート condition sceneHas{distinctNames,nMin3}**+
  sceneRemove{apMax8000} (状態不問=state無、a1/a2 の state 非対称が原文一致)。PR242=PR236 spread。

### 検証 (全 green)
- **回帰ゼロ確証**: 既存カードの distinctNames 使用は pick query 内のみ (D08021/B09010/B09010P)、sceneHas 内 0
  → 既存挙動不変。smoke baseline 不変 (avg=10.998/winsA=498/exc=0) が証跡。tsc0。
- vitest full **2724pass/1skip/0fail** (減なし)。新 `tests/cards/distinct-name-count.test.ts` **10件**:
  実 evalCond 駆動。§2 ★同名2print+別1→distinct=2 false / raw(length3)=true の挙動差 1対1 witness。§3-7 各 gate + 出荷4構造突合。
- playwright **121pass/1skip/0fail** (spectator-speed も pass)。4枚非MVP+engine inert で e2e 不変を実証。
- **敵対verify (opus、過剰発火+水平展開+fidelity lens)= OVERALL SHIP/refute0**。engine A1-A4 全 ship、カード fidelity 全 ship、exemplar 整合 ship。

### 学び (恒久)
- **standing green + engine変更0 枯渇後**: 残 DEFER は全 engine gate。着手前に **決定論 yield scan で実数確認**必須
  (handoff の「生産性尽きた」は正、単一 additive gate=3-5 base が上限)。**engine拡張 cluster は別判断** (骨格解凍)、ユーザー承認下で実施。
- **既存 TargetQuery flag の honor 経路拡張は最小コスト engine 追加**: distinctNames は pick-resolve のみ honor だったが
  sceneHas 計数でも honor=1分岐。新 kind 不要・回帰ゼロ (使用カード 0 を grep で確証)。同様の「既存 flag を別経路で honor」は低リスク弾。
- **DEFER の「distinct-name count」family**: B08067/PR236/PR242 出荷、B08063 は a1 self-trait-grant continuous (別 gate=ContinuousModifier に trait 付与無) で DEFER 継続。
- 次弾 micro-cluster 候補 (engine変更0 後): handToEvidence (2 verb, ~3 base) / continuous levelDelta (effort大・yield小)。DEFERRED-INDEX に scope 記録済。

### branch / commit
branch `cards/wave-distinct-name-count`。次=docs同期→pre-commit→commit→main ff-merge→push→CI green。
DEFERRED-INDEX の PR236 行→出荷済化 + distinct-name-count cluster section + B08063 DEFER 理由 追記済。
