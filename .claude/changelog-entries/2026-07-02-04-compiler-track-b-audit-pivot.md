# Track B compiler — audit pivot + BUG-162 (誤訳2件修正) + Track A demand-signal

**Round/Phase**: 2026-07-02 Track B (text→DSL compiler)。予定の B1.5 (parametric) → B2 (progressive bulk) を
**実測で空振り確認** → ユーザー承認のもと用途を「bulk author」から「**監査 + Track A 優先度シグナル**」へ pivot。

## 実測 (pivot の根拠、全決定論)

- **B1.5 parametric**: 数値/色/特徴/レベル/カード名 slot 抽象で mined rule を collapse → safe template **12 個**のみ。
  unshipped への unlock = **+0 枚** (unshipped の filler 値は全て shipped 既出 = 一般化次元が corpus に無い)。
- **B2 whole-line bulk**: 印字行が shipped と byte 一致する unshipped card = **1/539** のみ。
- **節分割 (「。」decomp) 上限**: 全 clause の 63.5% が新規、全 clause 被覆でも即 unlock は **9/539**。DSL は
  chain/binding 越境で節合成不能 = 高 mismatch risk。
- 結論: 残 539 枚は shipped の**組み替えでなく新規複雑文**。whole-line 文法は飽和。実 throughput lever = Track A engine 拡張。
  (memory「楽観前科 reusable 306→実2 / green 211→40%」と同型)。

## 成果1: compiler oracle が surface した誤訳を修正 → [[BUG-162]]

mine.cjs の conflict 検出 (同一印字行→異なる shipped DSL、6 key) を手動裁定 → **カード DSL 誤訳 2 件**確定・修正:

- **PR276 萩原千速** (promo、同一カード B03094 が Q&A grounded の正版): 3 誤り修正 —
  `sequence`→`chain` (「そうした場合」= gated) / `mill` に `gate:true` 追加 (deck<2 で AP+1000 不成立) /
  `charModifyAP scope:'turn'`→`'action'` (「アクション終了時まで」rules/22)。B03094 a2 と完全一致化。
- **D02004 服部平次** (水平展開で発見): 同型 `scope:'turn'`→`'action'`。PR276 が本カードを precedent に**誤引用**しており
  誤 exemplar が clone 伝播していた (carrier-reuse false-green)。
- 水平展開: 「アクション終了時まで」を含む全 shipped ability を機械走査 → non-action scope は上記 2 件のみ (逆パターン 0)。
- B07048 (faceUp 省略) は conflict だったが **benign** と裁定 (読取 falsy 判定で挙動同一、意図的省略テスト有り) → 変更なし。
  残 conflict 4 key (choice-wrap / condition vs matcherCondition / kind:character 有無) も benign encoding drift。conflict 6→5。

## 成果2: Track A engine 拡張 demand-signal → [[compiler-demand-signal-2026-07-02]]

unshipped 未知行を節分割・抽象し**影響カード数でランク**。上位需要 = ability/keyword grant (30) / MR partner-area 宣言 (19、spec済) /
event→char セット WRITE (9) / partner 事件解決 rewrite (8) / 証拠隠滅 敗北 (8) / multi-select modal (4)。B3 監査 queue =
gap-suspect 27 / exceptions 9 / conflict 5 も同 spec に記録。

## 検証

- tsc 0 / vitest: wave-deck-mill-gated-chain に ⑨ 追加 (PR276≡B03094・PR276 挙動 apMod_action=1000/gate・D02004 scope:action・
  D02004 sleep+stun 2枚→2000 の 4 test)、mined-rules G1 pin (mismatch=0) 維持・colornot (B07048 faceUp 省略 pin) green。
- smoke:1000 winsA=498 不変 (修正 2 枚は smoke デッキ CT-D08/D11 非収載)。8 lint errors=0。
- compiler 再現: tsv-corpus → dump-shipped → mine → oracle。line-rules.json/exceptions.json は shipped 修正を反映し再生成 (checked-in)。

## 方針転換の含意 (次セッション)

Track B の compiler は **回帰ゲート (G1 oracle) + 監査 + demand-signal** として恒久運用。bulk author は行わない。
Track A は demand-signal spec を engine 拡張優先度として消費 (着手前 origin/main 直読で stale 再採寸)。
