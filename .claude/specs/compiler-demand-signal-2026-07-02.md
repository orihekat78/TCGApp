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

## (a) Track A 拡張 需要ランク (unshipped 未知行の抽象クローズ、影響カード数順)

⚠ 各項目は**候補**。Track A は着手前に origin/main を直読し既出荷か再採寸すること ([[project-engine-first-plan-wave1]] の stale 教訓)。全リスト = `.tmp/compiler/demand-signal.json` (demand-signal.cjs で再生成)。

| # cards | 需要クローズ (抽象) | 候補 primitive / 備考 |
|---|---|---|
| 30 | 「〜を与える」(16) / 「〜を持つ」(14) | 任意 ability/keyword grant。keyword grant は既存 (grantKeywords)、**ability 文字列 grant** は novel |
| 19 | この能力はパートナーエリアでも宣言できる | MR partner-area declared ([[project-mr-partner-area-design-2026-06-23]] spec 済、未実装) |
| 9 | このイベントを自分の現場の【色】のキャラ N 枚にセットする | event→char セット WRITE。on-set-host READ 済 ([[reference-engine-additive-on-set-host-0629c]])、**使用イベントを host へ載せる verb** が残 |
| 8 | 自分の【色】パートナーの【事件解決】能力を書き換える | partner win-ability rewrite。novel・複雑 (勝利条件系) |
| 8 | 【証拠隠滅】〚証拠を事件レベル数リムーブ〛：相手は敗北 | 代替勝利 keyword「証拠隠滅」。novel |
| 5 | この能力はパートナーエリアでも発動する | MR partner-area triggered (同上 spec) |
| 4 | 以下から N つ選んで行う | multi-select modal (choice の N 択版) |
| 4 | 【ヒラメキ】【解決編】アクション中のキャラを N 枚スタン | contact-scoped stun + caseStatus gate |
| 3-4 | このカードをパートナーエリアに移す (hirameki 含) / このターン中ネクストヒント不可 / 突撃付与 turn-scope | 単発 verb 群 (self→partner-area move / nextHintBan は既出荷? 要確認 / grantKeyword turn) |

**conflict-blocked (Track A ではなく B3)**: 「【ヒラメキ】キャラを N 枚スリープ」(10)・「リムーブエリアの〚名/特徴〛を手札に加える」(5+4) 等は**既に shipped 済**だが mine の conflict (同文言異 DSL) で key が refuse され unshipped も compile 不可。canonical 化すれば unlock (下記 B3-2)。

## (b) B3 監査 queue (compiler 副産物)

1. **conflicts 残 5 key** (benign encoding drift と裁定、`.tmp/compiler/mine-report.json` conflicts): 単一 option `choice` vs bare atom (C1 hirameki-sleep / C5 grant-突撃) / `condition` vs `trigger.matcherCondition` (C4 contact→draw) / filter `kind:character` 有無 (C2 工藤新一) / set-card `faceUp:false` 明示 vs 省略 (C3 B05030 vs B07048、読取 falsy で挙動同一・B07048 は意図的省略テスト有り)。いずれも意味等価。**canonical 化すれば conflict-blocked 行が unlock** するが多数 shipped card の再編集を要す (要 tier 判断)。
2. **shipped-gap-suspect 27 枚** (印字行 > 実装 ability、`.tmp/compiler/mine-report.json` skipped): 部分実装疑い。B08079 等含む。要 per-card certify (印字全列 ⇔ DSL)。
3. **exceptions 9 枚** (composition-mismatch、`scripts/compiler/rules/exceptions.json`): B03129/B05024/B08044 (+P)・D04004・D09027・PR055。文法で shipped 再現不能 = 構造逸脱 (chain 越境 binding 等)。要調査。
4. **align-ambiguous 2 枚** (B09041/P): mine の行↔ability 対応が曖昧。

## 修正済 (本セッション)

compiler oracle が surface した誤訳 2 件を修正 → [[BUG-162]] (PR276/D02004 「アクション終了時まで」scope + PR276 gated-chain)。conflict 6→5 (C6 解消)。

## compiler 資産の恒久価値

G1 (mismatch=0) oracle + conflict 検出 = shipped 1510 枚の**回帰ゲート**。今後 Track A がカード追加/変更で同文言異 DSL を生むと mine/CI で surface される。再現: tsv-corpus → dump-shipped → mine → oracle。
