# 作業ログ — 名探偵コナンTCG プロジェクト

> 80 行ルールで sessions/ にローテート済。直近の詳細は各 session log を参照。

## 2026-06-12 (本セッション): Phase 0 commit + リファクタ Phase 1c〜2c
作業順はユーザー承認済 (NEXT-SESSION-PROMPT.md / refactor-plan/INDEX.md):
**① Phase 0 commit → ② リファクタ 1c〜2c → ③ カード wave#2 → ④ リファクタ 3〜4**。push も許可済 (本セッションでユーザー明示)。

### ① Phase 0 — ✅完了 (main へ push 済)
- 未コミット 196 件を 6 commit に分割し main へ ff-merge → push (38b354a2..60fb2c6b)。
  - (a) 45477b21 smoke reports / (b) f6217bcb Task D engine拡張 E0〜E4 + BUG-128/129/130
  - (c) 44248cbc Task D カード35枚 / (d) d88d4d59 リファクタ Phase 1a/1b
  - (e) 0c55b9dc docs + 起動 bat + .gitignore (.tmp-*) / (f) 60fb2c6b dev-knowhow-kit
- atom-handlers.ts は Task D と 1b が同居 → 1b ハンクを `git apply --cached -R` で index 分離し
  (b)/(d) に正しく振り分け。マージ前ゲート: typecheck 0err + full vitest 1961 pass/0 fail。
- 現カードファイル合計 1125 (auto/progress/cards.md)。

### ② リファクタ Phase 1c (fixture 統一) — ✅完了 (レビュー指摘4件解消済)
- 調査: makeChar/sceneChar/makeCtx 70 定義 (awk 抽出 + md5 正規化) → 30 グループに分類。
  計画想定「全部同一コピー」は不成立 → 設計を補正:
  - Group A (38 定義): 正準と挙動等価 → 定義削除 + `tests/helpers/fixtures.ts` から import
  - Group B (~20 file): 既定値/署名が異なる → 正準へ委譲する function wrapper (hoisting 維持。
    呼び出し箇所=テスト本文は不変)
  - Group C (5 定義): CardDef factory (registry/triggered/makeCharDef×2) + atom-souza 特殊 ctx → 対象外
- 旧スキーマは triggered.test.ts の 1 file のみ (計画の「4 ファイル」は mutate.scene.enter の
  API オプション `named:` の誤検知)。named/sets/stacked/caseLevel → 現行スキーマへ是正済。
- 機械置換は .tmp/apply-fixtures.py (one-shot、EOL 自動判別 — `git restore` が autocrlf で
  CRLF 化するため必須だった)。57 file 変更 (+84/−736)。
- ゲート: full vitest **1961 pass/0 fail** (baseline 一致) / eslint **baseline 46err と完全一致**
  (新規 0 — 未使用化した型 import 25 件は除去済。既存 46 件は Phase 4 候補として残置)。
- 敵対レビュー: Workflow wf_89123b08 (4観点・546k tok) → pass 3 + 指摘 4 件全て解消
  (.tsx 3 file 取りこぼし wrapper 化 / bug-123 makeCtx import 化 / ヘッダ表現訂正 / docs 再生成)。
  詳細: refactor-plan/phases.md §レビュー記録。grep は *.ts だけでなく **.tsx も必ず含めること (教訓)。

### ② リファクタ Phase 2a (PA短縮形 gate helper 化) — ✅完了
- paShortFormAwait helper を atom-handlers に追加、uid-carrier 11 verb の awaiting-pick
  コピペを置換 (+46/−59)。**計画の「chooser=controller 固定」は不採用** — a.player=操作者規約の
  4 verb (BUG-131 裁定) の挙動を変えるため、chooser/side を明示引数化 (挙動完全不変)。
- 敵対レビュー Workflow wf_5b2ed17f 3観点 **全 pass** (レビュアーが HEAD vs 現行の差分実行
  13 probe deep-equal 一致を確認)。minor 指摘「awaiting-pick 恒久テスト 4/11 verb のみ」
  → 残り 7 verb の characterization を同フェーズで追加 (vitest 1961→**1968** pass)。
- ゲート: typecheck 0 / full vitest 1968/0fail / smoke:1000 baseline 完全一致 (469/531, 10.86) /
  e2e 26 pass / eslint 新規 0。
- 教訓: ブロックコメント内に `charModify*/` と書くと `*/` でコメント終端 → 構文エラー。`系` で代替。

### ② リファクタ Phase 2b (手動同期ペア単一ソース化) — ✅完了
- satisfies map ×3 (AtomVerb/Cost/Condition) + exhaustive default ×4 + TRIGGERED_HOOKS export
  + sync-taskA-whitelists.test.ts (4 tests、偽陰性検出能力を fake verb 注入で実証)。
- レビューは新トークンポリシー初適用: 決定論検証 + opus 1 lens (94k tok) → pass / 指摘0。
- ゲート: typecheck 0 / vitest 1972/0 / smoke baseline一致 / e2e 26。
- limit 枯渇 (16:45) で旧フルパネルレビューが一度失敗 → ポリシー策定の契機 (CLAUDE.md
  「トークン運用ルール」+ settings.json hook ④ + memory feedback-token-economy 参照)。

### 2026-06-12 (続々): トークン運用整備 + 外部リソース導入
- CLAUDE.md「トークン運用ルール」「標準活用リソース」新設 / settings.json に phase-commit hook。
- GitHub Actions CI (.github/workflows/ci.yml: tsc+vitest+lint7+smoke、ubuntu、docs:check除外) 導入。
- .mcp.json 新設: Serena (uvx、次セッションから有効) + firecrawl (要 FIRECRAWL_API_KEY)。
- **project skills 新設 (writing-skills TDD 準拠)**: `/refactor-phase` と `/card-wave`。
  RED baseline で「push しない (stale)」「docs 再生成順序」「check:smoke-baseline 未使用」の
  ギャップを確認 → skill で封鎖 → GREEN 検証 2 本とも合格 (card-wave は tool 13→2 回に減)。
  以後、該当作業ではまず対応 skill を呼ぶこと。

### 残り
- Phase 2c (dispatch 契約是正) → 1commit。その後 ③ カード wave#2 → ④ Phase 3〜4。
- ③ カード wave#2: green候補残 ~260 + engine拡張 wave#2 (task-d-priority-map.json 次ゲート群)。
- ④ Phase 3〜4 は着手前に個別設計レビュー必須。

## 直近完了 (詳細は sessions/)
- Task D engine拡張 wave#1 (sessions/2026-06-12.md) / Task A certify-harvest 254/254 (sessions/2026-06-11.md)
- dev-knowhow-kit (31 files、Phase 0 で commit 済)

## 2026-06-12 (夜) リファクタ Phase 2c — dispatch 契約是正 (BUG-116 構造解消)
- 新設 engine/flow/main/ability-activate.ts に cost+ctx 構築 + pay を一元化。呼出元 (UI/AI/e2e) は
  {type, uid, abilId, costParams?} のみ。effectPickResolve 4 形態 union 化。
- silent-skip 依存 e2e 7 箇所を機械棚卸し (tsx で def cost 抽出) → assert 影響は B06069 のみ、実 assert 化。
- ゲート: tsc 0 / vitest 1972 (baseline一致) / smoke baseline 完全一致 / e2e 6 spec 33 pass / lint 新規0。
- レビュー: 決定論 + Fable 1 lens — BLOCKER/MAJOR 0。MINOR-2 (cost-not-paid 警告 false-positive 化) は
  後続フェーズ項目として review-records.md §2c に記録。phases.md 100 行超過 → review-records.md 分割。
