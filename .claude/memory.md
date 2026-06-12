# 作業ログ — 名探偵コナンTCG プロジェクト

> 80 行ルールで rotate 済。リファクタ Phase 0〜2c の詳細は changelog-entries/2026-06-12-03 +
> refactor-plan/phases.md + review-records.md / sessions/2026-06-12.md を参照。

## 現在地 (2026-06-12 末)

ユーザー承認の作業順: ① Phase 0 commit → ② リファクタ 1c〜2c → **③ カード wave#2 (完了)** →
④ リファクタ Phase 3〜4。push 許可済。

### ③ カード wave#2 — ✅完了 (branch `cards/wave2-handauthor`)
- **重要発見**: green候補の pure-JSON codegen 経路は**枯渇** (`collect-greens`→0 adoptable)。
  prompt の「残 ~260」は stale (30/254 当時)。実際は 105枚 certify-harvest (38b354a2) で吸収済、
  certify-queue は 251/254 済。残りは yellow176 / already-impl63 / refuted4 / needsManual5 等。
- **出荷 3枚** (engine変更0、ALL_CARDS +3): D09016(FILE6行動 諸伏高明)/D09017(clone)/B05076(解決編 ジョディ)。
  D09016 は Fable 敵対 verify GREEN、B05076 は壊れた .verify.json を修復して採用。
- **DEFER**:
  - B08020/P (遠山和葉): 実装 green だが敵対レビューで**共有 engine gap 2件** (deckRevealUntil
    force-add / effect:declared 解決順序) → **BUG-132** 起票、engine拡張 wave#2 へ。出荷済
    D01013/B07016 と同一 gap。実機 (Playwright MCP) で deck filter + 色matcher は faithful 確認済。
  - B07052: **data-gate** — 〚特徴［赤魔術］〛が全カード trait に未投入 (無音 no-op)。横展開:
    出荷済 B07062 a2 も同 data-gate で latent no-op。
  - refuted 4枚 (B02026/B07104/B09038/B09097) は fatal 乖離付き DEFER。全て DEFERRED-INDEX 記載。
- **ゲート全 green**: validate-specs 70/0 / tsc 0 / vitest 1972 pass・1 skip (baseline) /
  smoke:1000 baseline 完全一致 (469/531, 10.86, exc 0) / e2e 119 pass・1 skip。
- **教訓**: certify green は filter/順序の**機構**を検証するが、**データ存在** (B07052 trait) や
  **解決順序** (B08020) は別。実機 decoy 検証で踏むこと (BUG-117/118 教訓の拡張、BUG-132)。

### 次セッション: ④ リファクタ Phase 3〜4 (or engine拡張 wave#2)
- engine拡張 wave#2 = task-d-priority-map.json の次ゲート群 (FILE-zone verb 30 / grant-textual 23
  等) + BUG-132 の GAP-1/2 修正 (修正後 B08020 再採用)。Fable 主体・gate毎に設計レビュー必須。
- Phase 3〜4 は着手前に個別設計レビュー必須。

## ポインタ
- defer 一覧: `.claude/specs/DEFERRED-INDEX.md` / bug: `.claude/bugs/index.base` (最新 BUG-132)
- green候補マスタ: `.claude/specs/catalog-survey-2026-06-06/` / capability 正本: 同 capability-map.txt
