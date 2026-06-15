# 次セッション再開プロンプト (2026-06-15 cluster12 + cluster13 連続出荷時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (triage certify / 意味等価突合 / 敵対設計レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **push 確認**: cluster12 (`5d33bcd0`) + cluster13 (`abaef1a2`) + 本 docs commit が push 済か次セッション開始時に
> `git log origin/main..main` が空であることを確認すること。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15、engine拡張 wave#2 cluster12 + cluster13 連続出荷)

- engine拡張 wave#2 cluster1〜9 + 11 + **12 + 13** ✅ + BUG-145/146 ✅ + 赤魔術 family ✅。ALL_CARDS = 1207。
  cluster10 (loseGame) は DEFER 継続。origin 同期確認 (`git log origin/main..main` 空)。
- **直近セッション = triage で 2 gate 実証選定 → 連続出荷**:
  - **cluster12 (nested-filter-dyn)** `5d33bcd0`: 「FILE枚数以下レベルの登場」系。resolve-picks.substituteAtomPick で
    pick filter 内 {dyn} を targetCandidates 列挙前に解決 (resolveTargetFilterDyn、frozen def clone・型非widen・filter/filterAny両対応)。
    15 printings (小さくなった名探偵 family 13 + B08060/P)。CI green。
  - **cluster13 (aura-grant)** `abaef1a2`: 「【自分ターン中】他キャラを AP＋1000」型 aura (continuous OWNER-ONLY 解除)。
    ContinuousModifier += apDeltaAura/auraFilter/auraExcludeSelf + read/char.auraDelta board-scan + candidates.auraDeltaSafe
    (再帰guard) を ap/lp/matchOneFilter に合算 (filter-AP=combat-AP)。11 printings。
  - 両クラスタとも opus 7-agent triage + 3-lens 敵対設計レビュー = 全 GO / 0 blocker。
    全 gate green: tsc0 / vitest 2214 / smoke winsA498 baseline **不動** (両 engine 変更とも no-op) / playwright 119 / CI lint errors0。

## 次にやること (候補、ユーザーと相談 or triage から選定)

- **backlog の残 engine gate** (DEFERRED-INDEX landscape、いずれも needs-design):
  - name-designation (宣言 UI surface + AI policy + designated-name condition — 最大歩留まりだが coupled UI+AI 設計)
  - multi-card sceneEnter (「2枚まで選び登場」、triage で switch-wiring 欠如が判明 = sceneEnter multi-pick+switch 契約が必要)
  - partner-area 構造 (GameState slot + UI、ビッグジュエル/MR列挙)、mustGuard (forced GuardPickerModal)、
    auraGrant(triggered 付与) (非キーワード能力テキスト付与)、loseGame (事件解決書換 high-risk multi-gate)。
  - triage workflow で ready-now を再選定 (教訓: 未精読 gate の low-risk ラベルは信用せず per-card certify/diag で実証)。
- **低 urgency engine bug**: BUG-142 (reasoning 由来 refresh 水平展開)、BUG-143 (contact-scope mod 清掃) 等。

## プロセス必須
- /card-wave skill。green候補は未certify なら信用しない。engine 変更は骨格凍結例外手続き (rule/bug 根拠) +
  敵対設計レビュー (opus 3-lens) + 全 gate (full vitest / smoke 不動 or 再 bless / playwright / CI lint 8本)。
- 高リスク広域変更時は consumer/合算サイトを決定論 grep で全列挙してから着手。hot-path 触る変更は smoke baseline 不動 = no-op+性能影響なしの両証跡。
- 非MVP カードは behavioral vitest が実機検証の正 (filter-AP=combat-AP 等の不変条件もテストで実証 = cluster13 §4 教訓)。
- 1 gate = 1 独立コミット。docs commit は **`.tmp` を消してから** `npm run docs` → `git add -A` → commit
  (structure.md が working-dir のファイルを拾うため)。validate-specs は `.tmp/certify` 存在前提なので消さない (or mkdir)。

## 状態 doc
- bug: .claude/bugs/index.base
- defer: .claude/specs/DEFERRED-INDEX.md (cluster12 ✅ / cluster13 ✅ 節 + 残 landscape gate)
- 詳細: changelog-entries/2026-06-15-08 (cluster12) / -09 (cluster13) / memory.md セッション⑦ + sessions/2026-06-15*.md
```

直近セッションは cluster12 (`5d33bcd0`) + cluster13 (`abaef1a2`) + 本 docs commit の連続出荷。
次セッションは origin 同期確認 → triage で次 gate 選定から。`/clear` で新セッション推奨。
