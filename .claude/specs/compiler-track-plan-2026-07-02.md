# Track B: カード追加ツール (text→DSL compiler) 計画 (2026-07-02)

目的: カードテキスト→DSL の silent 誤訳の源 = **AI の即興翻訳** を whitelist 文法 compiler で構造排除する。
一致句のみ変換、**未知句 1 つでも card 全体 refuse → DEFER queue** (partial 変換禁止)。
間違い方を「静かに誤る」→「うるさく止まる」に反転し、裁定は文法へ 1 回だけエンコードする。

## 設計 (パイプライン)

1. **corpus 抽出**: `.claude/specs/cards-data/**/*.tsv` 全カードの印字全列
   (col10 effect + col11/12/13 cutin/hirameki/henso — [[feedback-card-grounding-all-printed-columns]]) を正規化。
2. **句分割**: 【】〚〛アイコン / 「:」コスト境界 / 「。」節 / 「その場合」「代わりに」接続を構造化。
3. **production match**: 句形→DSL 断片。lexicon 種 = engine-extension TSV の **cardTextPattern/representativeQuote** 列
   + **shipped exemplar ペア** (Track A が wave 毎に同梱するカード = 機械可読 spec)。
4. **合成**: sequence / conditional / cost / binding ($pick/$revealed) の組上げ。裁定テーブル同時適用
   (「〜まで」=0可 / 「する」=必須 (rules/15) / colorNot some説 (B08079) / exact-N / deck-look 型別 (rules/26))。
5. **検証**: validate-specs whitelist (未登録 field=fail) + 決定表 diff (生成 DSL ⇔ TSV 印字列)。
6. **emit**: CardDef codegen (既存 taskA codegen 流儀、registry barrel 追記)。

## Oracle (最重要・G1 ゲート)

- 実装済 **1514 枚**: 印字テキスト→compile→**shipped DSL と正規化 diff** (key 順・等価形を吸収)。
- 判定 3 値: match / refuse / **mismatch**。**G1 = silent mismatch 0** — mismatch は「文法修正」or
  「refuse へ降格」しか許さない。G1 未達のまま bulk 出荷禁止。
- 計測: match% / refuse% / 残 535 への適用率。**この実測が出るまで session 数を確定しない**
  (楽観前科: reusable 306→実2 / green 211→歩留 40%)。

## セッション分解 (5-9 session)

| # | 内容 | gate | 目安 |
|---|------|------|------|
| B0 | harness: corpus 抽出 + shipped DSL 正規化 loader + oracle diff runner + refuse レポート (全部決定論 script) | T1 | 1 |
| B1 | 文法 core: 句分割 + production rule 集 + 裁定テーブル → **G1 達成**。文法 rule 集へ敵対 review 1 回 (2 lens) | T2 | 1-2 |
| B2 | **progressive bulk**: 出荷済 primitive の family から順に一括 compile → 60-80 枚/commit。family exemplar probe + UI 新部品「型」のみ playwright | T1/T2 | 2-4 |
| B3 | refuse queue 手動 certify + Q&A 依存 DEFER 精算 + except リスト化 (Ph7 相当) | T2 | 1-2 |

## Track A との interface / 衝突回避

- **A→B**: 各 engine wave の **exemplar カード 1-2 枚** (同 commit) = B の oracle 入力 + 新 primitive の文法 spec。
  production rule の登録責務は **B 専任** (A は書かない)。
- **B は `src/engine/**` を一切触らない** (骨格凍結)。engine 不足を発見したら DEFER で Track A へ送る。勝手に拡張しない。
- B の作業領域 = `scripts/compiler/**` + `tests/compiler/**` + (B2 以降) `src/cards/**` bulk 追加。
- **B2 の family 制約**: 「1 wave 以上前に main 出荷済みの primitive」の family のみ compile 可
  → A の exemplar 追加と card ファイル/barrel が衝突しない。
- worktree: `git worktree add -b tool/compiler-<n> /c/tmp/<dir> origin/main` → FF push (`git push origin HEAD:main`)。
  node_modules junction 撤去は [[feedback-worktree-remove-junction-hazard]] 手順。

## compiler の守備範囲外 (別装置が担保)

- engine honor gap (BUG-117 型: DSL 正しくても engine 未評価) → family exemplar の probe test。
- 文法 rule 自体の誤り → B1 の敵対 review 1 回で数百枚分を償却。
- 真の裁定不明カード → refuse → 公式 Q&A 送り (設計通り)。

## 完了定義

文法が全 shipped primitive を被覆 + G1 (mismatch 0) 維持 + refuse queue が「Q&A 依存 + 真の特殊カード」のみ。

## 関連

- 全体計画: [all-cards-completion-plan-2026-07-02.md](all-cards-completion-plan-2026-07-02.md) /
  プロセス: [speed-rebalance-2026-07-02.md](speed-rebalance-2026-07-02.md) /
  Track A driver: [engine-extension-plan-2026-06-30.md](engine-extension-plan-2026-06-30.md)
