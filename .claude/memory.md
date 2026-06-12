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

### 残り
- Phase 2a (PA短縮形 gate helper 化) / 2b (手動同期ペア機械検証) / 2c (dispatch 契約是正) → 各1commit。
- ③ カード wave#2: green候補残 ~260 + engine拡張 wave#2 (task-d-priority-map.json 次ゲート群)。
- ④ Phase 3〜4 は着手前に個別設計レビュー必須。

## 直近完了 (詳細は sessions/)
- Task D engine拡張 wave#1 (sessions/2026-06-12.md) / Task A certify-harvest 254/254 (sessions/2026-06-11.md)
- dev-knowhow-kit (31 files、Phase 0 で commit 済)
