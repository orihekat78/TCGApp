# Track B compiler — demand-signal + audit queue (2026-07-02)

Track B (text→DSL compiler) の B1.5/B2 実測が空振り (下記) → 用途を **bulk author から「監査 + Track A 優先度シグナル」へ pivot** (ユーザー承認 2026-07-02)。
本ファイル = compiler が機械抽出した (a) Track A 拡張の需要ランク、(b) B3 監査 queue。数値は `.tmp/compiler/*.json` から再生成可能。

## 実測 (なぜ pivot したか)

| 施策 | unlock | 実測 |
|---|---|---|
| B1.5 parametric (数値/色/特徴 slot 化) | **+0 枚** | safe template 12、全て既 exact 被覆行にのみ発火 (unshipped の filler 値は全て shipped 既出) |
| B2 whole-line bulk | **1→2/539 枚** | 印字行が shipped と byte 一致する card のみ full-compile |
| 節分割 (「。」decomp) 上限 | **9/539 枚** | 節の 63.5% が新規、DSL は節合成不能 (chain/binding 越境)、高 mismatch risk |

結論: 残 539 枚は shipped の**組み替えでなく新規複雑文**。whole-line 文法は飽和。実 throughput lever は Track A engine 拡張。

## (a) Track A 拡張 需要ランク (**再採寸済 2026-07-02**、origin/main 8ae3f56f 直 grep)

再生成: `node scripts/compiler/demand-signal.cjs` → `.tmp/compiler/demand-signal.json` ({lines, subclauses} 2 粒度・ids 付き)。
初版候補を engine 直読で再採寸 → **真の Track A 需要は 4 family のみ**。残りは既出荷で card-phase 送り:

| # cards | 需要 (真の engine gap) | ids / 備考 |
|---|---|---|
| 8 | partner【事件解決】書き換え + 代替勝利【証拠隠滅】= **同一 8 枚** (初版 8+8 は二重計上) | B03135/B05118/B05119/B06105-108/D07024。P10/E3 (勝敗系 rewrite) |
| 4+3 | 非MR カードの PA 移動 + PA〚ビッグジュエル〛計数 aura (G39 PA card slot) | B07059/B07060/PR195/PR196 (+計数 3)。mutate/partner.ts 旧 stub は dead 化済 = 未実装 |
| 4 | 「アクション中のキャラ」TargetFilter 軸 (【ヒラメキ】【解決編】K枚スタン) | B03085/B05032/B05111/B08006。stun verb (sceneSetState) は有、filter 軸のみ novel |
| 4 | 「以下からKつ選んで行う」multi-select (G34) | B05023/B05062/B07013/B09067。choice atom は 1 択のみ |

**降格 = engine 出荷済 (card-phase authoring へ)**:
- **MR PA 宣言 19 + PA 発動 5**: mr-partner-area core **出荷済** (bef3adad+5352c470 = on-partner-area scope declared/triggered + partnerAreaMR slot)。auto-mem「未実装」は stale。per-card 残 gate は要実測
- **set-event family ~15**: charSetCard fromSelf WRITE (0629d) + on-set-host rider READ (b34d33cc) 両出荷 → B01023/B01039/B01057/B02052/B02067/B03041/B03080/B05041/B05117/B06012/B06063/B06064/B07014/B08017/D10024
- **keyword turn-grant 散発 ~13** (突撃等): grantKeyword(scope turn/permanent) 出荷済
- **ability grant (turn)**: charGrantAbility (Task D E4) 出荷済。turn 清掃のみ = permanent 形は per-card 確認
- **【事件緑＆白】〚突撃〛4**: caseColor color[]+combine:'and' 出荷済 → ENGINE0 (D06003/04/21/23)

**conflict-blocked (Track A ではなく B3-1)**: 「【ヒラメキ】キャラをK枚スリープ」(10: B01020/B02076/B04073/B05008/B05097/B06078/B06085/B08008/B08036/PR133)・「リムーブエリアの〚名/特徴〛手札回収」(5+4) は engine/文法とも被覆済だが conflict で key refuse。canonical 化で unlock = B3-1 の ROI 根拠。

## (b) B3 監査 queue (compiler 副産物)

1. **conflicts 残 5 key** (benign encoding drift と裁定、`.tmp/compiler/mine-report.json` conflicts): 単一 option `choice` vs bare atom (C1 hirameki-sleep / C5 grant-突撃) / `condition` vs `trigger.matcherCondition` (C4 contact→draw) / filter `kind:character` 有無 (C2 工藤新一) / set-card `faceUp:false` 明示 vs 省略 (C3 B05030 vs B07048、読取 falsy で挙動同一・B07048 は意図的省略テスト有り)。いずれも意味等価。**canonical 化すれば conflict-blocked 行が unlock** するが多数 shipped card の再編集を要す (要 tier 判断)。
2. **shipped-gap-suspect 27 枚** (印字行 > 実装 ability、`.tmp/compiler/mine-report.json` skipped): 部分実装疑い。B08079 等含む。要 per-card certify (印字全列 ⇔ DSL)。
3. **exceptions 9 枚** (composition-mismatch、`scripts/compiler/rules/exceptions.json`): B03129/B05024/B08044 (+P)・D04004・D09027・PR055。文法で shipped 再現不能 = 構造逸脱 (chain 越境 binding 等)。要調査。
4. **align-ambiguous 2 枚** (B09041/P): mine の行↔ability 対応が曖昧。

## 修正済 (本セッション)

compiler oracle が surface した誤訳 2 件を修正 → [[BUG-162]] (PR276/D02004 「アクション終了時まで」scope + PR276 gated-chain)。conflict 6→5 (C6 解消)。

## compiler 資産の恒久価値

G1 (mismatch=0) oracle + conflict 検出 = shipped 1510 枚の**回帰ゲート**。今後 Track A がカード追加/変更で同文言異 DSL を生むと mine/CI で surface される。再現: tsv-corpus → dump-shipped → mine → oracle。
