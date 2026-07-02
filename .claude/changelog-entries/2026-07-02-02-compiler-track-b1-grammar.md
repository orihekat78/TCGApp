# Track B B1 — 文法 core: mined 行 rule 651 本で shipped 77% 再現 (G1 mismatch 0)

- **日付**: 2026-07-02
- **種別**: feat(compiler)
- **Track**: B (カード追加ツール / text→DSL compiler)。engine 変更 0。

## 何ができたか

- **行 rule 採掘器** `scripts/compiler/mine.cjs` (全決定論、AI 翻訳ゼロ): shipped CardDef の
  `AbilityDef.description` ⇔ TSV 印字行の突合せで「行 key → 意味射影 ability / keywords」を機械採掘。
  desc 突合 + 消去法 pairing (oracle dry-run + purge loop で誤 pairing 自浄)。敵対 review が「refuse する card 由来の elim rule は composition 未検証のまま出荷される」BLOCKER を具体反例 (B08007 header 行 → 幻 AP+1000 rule) 付きで検出 → purge 条件を「match 済 exemplar 0 の elim rule 全除去」に強化し 30 rule を追加除去 (match 影響 0 = 幻 rule 群は match に無寄与)。合成 fixture 回帰 tests/compiler/mine.test.ts で pin。
- **文法 rule 集** `scripts/compiler/rules/line-rules.json` (**623 rules**、全 rule が shipped exemplar 根拠 + 消去法起源は match 済 exemplar 必須) +
  `rules/exceptions.json` (composition で再現不能な 9 枚を id 単位 refuse — B3 調査 queue)。
- **oracle 意味射影化** (`canonical.semanticCard`): ability の id/name/description/ruleRefs は非意味
  metadata として比較除外 (a1/a2 揺れ・注釈揺れの実測に基づく)。type/scope/trigger/condition/cost/
  limit/effect/continuousModifier + keywords + 配列順は厳密比較。
- **句分割** (`norm.cjs` + `compile.cjs`): 列 → 印字行 (literal `\n` / `<br>`)。括弧注釈 （…）/(…) は
  key から全 strip (公式 59 種を全数目視で注釈確認、icon 内括弧 0 実測)。colspan (列全体 = 複数行
  1 能力、B03026 型) を行 rule より先に lookup。
- **G1 達成**: shipped 1509 oracle で **match 1161 (77.0%) / refuse 348 / mismatch 0**。
  非 closure 天井 1260 の 92%。vitest `tests/compiler/mined-rules.test.ts` が G1 を恒常 pin。

## 副産物 (shipped 側の実在不整合を compiler が検出)

- **conflicts 6 key**: 同一印字文言 → 異なる DSL (例:「【ヒラメキ】キャラを1枚まで選び、スリープさせる。」
  が pick 型/choice 型/side:either 型の 3 変種)。refuse-first で rule 化拒否済。B3 で正誤裁定。
- **shipped-gap-suspect 27 枚**: 印字行に対応 ability が無い部分実装疑い (B02023/B02030/B03032 等、
  DEFERRED 意図出荷の可能性)。`.tmp/compiler/mine-report.json` に記録。

## ゲート

- tsc0 (main + scripts) / vitest **3574 pass** (+22、baseline 3552) / smoke:1000 **winsA=498 不変**
  (timeouts=0, exceptions=0) / lint 8 本 errors=0 / 敵対 review 2 lens (opus、semantic-safety=BLOCKER 1 件検出→修正 / edge-verification=SHIP_WITH_NITS、決定論性 byte 同一・G1 再現を実測確認)。

## 残課題 (B1.5/B2 へ)

- parametric rule (数値/色/特徴/名前 slot 化) 未着手 — unshipped 540 は「未知行 1 本のみ」214 枚で
  exact→parametric の効きが良い地形 (line coverage 215/1155)。
- case カードの caseTraits は TSV 非収載 (oracle 対象外) — B2 emit 時の供給源を要設計。
- closure 249 枚 = 恒久 refuse (設計判断: custom TS は rule 化不能 → 手動枠)。
