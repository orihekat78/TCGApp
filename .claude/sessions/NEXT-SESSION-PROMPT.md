# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Round 4h caseTraitConditioned + BUG-031 data fix 完了 (2026-05-19 / 最新 `08621c0`)。
次の作業を開始したい。

## 完了状態

**Round 2 + Round 3 + Round 4a-4h** 計 26 連続 commit:

- Round 2/3 (2026-05-18): UI/UX 18 件 + B4/B7 (`e61bb7f` 〜 `c8118d0`)
- Round 4a (`e10b3a4`): RCA + 水平展開 + engine 3 fix + Obsidian Base 化
- Round 4b (`4c64c79`): triggered ability 汎用 listener (7 hook)
- Round 4c (`d54e328`): BUG-006 修正 (store.dispatch shallow copy) + @playwright/test 基盤
- Round 4d (`f38268c`): Playwright headed default + Round 2 18 件 BUG-XXX 移行 + BUG-029
- Round 4e (`cf3380c`): E2E helpers 整備 + cutinFixedAP 6 カード
- Round 4f (`4eb103a`): partnerColorKeyword 5 カード + BUG-030 登録
- Round 4g (`3932d04`): BUG-030 engine 修正 (continuous modifier resolver) + smoke 525-475 positive shift
- Round 4h (`08621c0`): caseTraitConditioned 2 カード + BUG-031 data fix (D11021 '婚活' trait)

## テスト状況

- **1464 PASS + 1 skipped** / 192 test files / typecheck clean / docs:check clean
- **E2E 19 pass + 1 skipped** (bug-006 1 + bug-029 2 + cutinFixedAP 6 + partnerColorKeyword 6 + caseTraitConditioned 4)
- **1000戦 smoke 525/475** (Round 4g 以降の新 baseline、avg turns 9.85、0 例外 / 0 timeout)
- リスク・バグ管理: `.claude/bugs/index.base` (BUG-001〜031 計 31 件、修正済が大半)

## 重要な反省 (Round 4e-4h で 3 連続 engine gap 発見)

E2E spec 化が engine の隠れた gap を可視化することが続けて証明された:

1. **BUG-030** (Round 4f 発見 / 4g 修正): `read.char.keywords` が continuousModifier.grantKeywords を resolve しない (Phase 5 未実装) → engine ロジック gap
2. **BUG-031** (Round 4h 発見・修正): D11021 case card に '婚活' trait が未設定 → engine データ gap
3. → **新規 spec 化は engine layer の精度向上効果が高い** (今後も継続)

## 残課題 (本セッションで選んでください)

### Round 4i-k (残り共通パターン spec 化)

1. **Round 4i**: eventRemoveByAP 2 カード (D08025 / D11020) E2E spec
   - hand 使用 → effect:declared listener → AP 比較で対象 scene char リムーブ
   - dispatch: `handUseCard` + 既存 helper 流用
2. **Round 4j**: hiramekiDraw 2 カード (D08013 / D08024)
   - action[case] で証拠リムーブ → hiramekiResolve 発動可否 → ドロー効果
   - dispatch: pendingHirameki state machine + hiramekiResolve choice
3. **Round 4k**: hiramekiCharStun 2 カード (D08019 / D11009)
   - hiramekiDraw と同経路、effect が sceneSetState(sleep)

### Round 4l+ (UI 課題、未着手)

4. **BUG-001 カード拡大表示**: パートナー/現場/事件クリック → 拡大 modal (共通 `useCardExpandModal` hook)
5. **BUG-002 edition tag 隙間**: left-col grid gap=0 + 子 padding 調整
6. **BUG-010 opp turn 可視化**: `pauseOnAction` + MAX_MOVES timeout 明示化 + action ハイライト
7. **(旧 Round 3d) B5 観戦モード**: GameSetupModal に観戦 button + 両プレイヤー AI hook

### 運用

8. **origin/main push**: 現在 local main に約 **29 commits 未 push**、共有前に push

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認 (Round 4a-4h で §セルフレビュー / §バグ管理 / §骨格凍結 §例外 整備済)
2. `.claude/bugs/index.base` を Obsidian で開いてバグ状況確認 (BUG-001〜031)
3. `git log --oneline -10` で Round 4a-4h commit 確認
4. `.claude/sessions/2026-05-19-4.md` で Round 4h 詳細把握 (BUG-031 data fix 含む)
5. **必要に応じて `.claude/rules/` 精読** (Playwright プレイ前は必須)
6. 上記候補から 1 つ選んで brainstorming → plan → 実装
7. UI/engine 修正含む場合は **Playwright 1 試合通し検証** + smoke baseline 再認証必須

## エッジケース (CLAUDE.md §設計レビュー)

- engine 編集は §骨格凍結原則 §例外 (engine 自体のバグ修正 / データ整合性修正) を厳守
- §セルフレビュー: Playwright 1 試合通し、新規バグ発見時は BUG-XXX.md 作成 (frontmatter 必須)
- E2E spec 化中に engine gap を発見した場合は BUG-030/031 と同様の救済パターンで対処
- prefers-reduced-motion / aria-label / React 19 fiber static flag 回避
- continuous modifier resolver (Round 4g 実装) は apDelta / lpDelta 系も将来同パターンで拡張可
```

---

## 参考

- 直近 commit: `08621c0` (Round 4h caseTraitConditioned + BUG-031) — local main のみ (未 push)
- ベース: 1464 PASS + 1 skipped / 192 files / E2E 19 pass / smoke 525-475 / typecheck clean / docs:check clean
- 主要レポート:
  - `.claude/sessions/2026-05-19-4.md` — Round 4h: caseTraitConditioned + BUG-031 data fix
  - `.claude/sessions/2026-05-19-3.md` — Round 4g: BUG-030 engine 修正
  - `.claude/sessions/2026-05-19-2.md` — Round 4f Phase 2: partnerColorKeyword + BUG-030 登録
  - `.claude/sessions/2026-05-19.md` — Round 4e Phase 1: E2E helpers + cutinFixedAP
  - `.claude/sessions/2026-05-18-9.md` — Round 4d: Playwright headed default + Round 2 履歴移行
  - `.claude/sessions/2026-05-18-8.md` — Round 4c: BUG-006 修正 + Playwright E2E 導入
  - `.claude/specs/risk-and-bug-tracker.md` — RCA + 水平展開計画 + 凡例
  - `.claude/bugs/index.base` — Obsidian Base view (BUG-001〜031)
  - `.claude/reports/smoke-2026-05-19-{1..5}.{json,md}` — 1000戦 smoke レポート群
