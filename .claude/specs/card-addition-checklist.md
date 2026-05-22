---
updated_at: 2026-05-18
phase: 規約
status: active
---

# カード追加時のチェックリスト

Round 4a Phase 6.2 で導入。新規カード追加 PR で本チェックリストを必ず通すこと。

CLAUDE.md §骨格凍結原則 / §設計レビュー §水平展開 と連動する補助規約。
本リストの目的は **「カード定義は書いたが、対応する engine 配線を忘れて effect が無反応になる」** という Round 1-3 で多発した バグ (BUG-005 / BUG-007 / BUG-008) の **再発防止**。

---

## チェック項目

### 1. カード kind ごとの dispatch 経路網羅

カードの `kind` を確認:

- [ ] `character` — 通常の現場登場経路 ([src/engine/flow/main/hand-use-card.ts](../../src/engine/flow/main/hand-use-card.ts) / [next-hint.ts](../../src/engine/flow/main/next-hint.ts) で kind 分岐済?)
- [ ] `event` — 手札使用 → 効果解決 → リムーブ移動 の 3 段階分岐済?
- [ ] `partner` — パートナーエリア配置経路は OK?
- [ ] `case` — 事件エリア配置経路は OK?

**Round 4a 教訓**: `kind='event'` 分岐は `handUseCard.ts` / `next-hint.ts` 両方で 欠落していた (BUG-008)。新規 kind 値を追加する場合は全使用経路 (5 経路: handUseCard / next-hint / scene enter / カットイン / 変装) のマトリクスを確認。

### 2. trigger.hook ごとの listener 配線確認

カード定義の `trigger.hook` を grep し、`src/engine/listeners/` 配下に listener 登録があるか確認:

- [ ] `'enter'` — `triggered.ts` の `event.on('enter', ...)` で登録?
- [ ] `'effect:declared'` — listener 登録?
- [ ] `'action:declare'` — listener 登録?
- [ ] `'action:guarded'` — listener 登録?
- [ ] `'contact:start'` — listener 登録?
- [ ] `'case:to-resolved'` — listener 登録?
- [ ] `'phase:end:start'` — listener 登録?
- [ ] `'evidence:remove-by-action'` — `hirameki.ts` で登録済
- [ ] `'reasoning:before-add'` — `misread.ts` で登録済
- [ ] **新規 hook を使う場合**: 必ず listener 側に追加実装

**教訓**: 新規 hook 追加時は listener 登録必須 (Round 1-3 で 7 hook 全 noop / BUG-005 / BUG-007)。`scope: 'on-hand'` + `triggered` は `trigger.selfOnly: true` 必須 (両プレイヤー手札 scan / BUG-032 / Round 4i-fix)。

### 3. effect descriptor の resolver dispatch table 確認

カードの `effect.kind` (`atom` / `sequence` / `choice` / `conditional` 等) と `verb` (`draw` / `discard` / `sceneEnter` / `evidenceToHand` 等) を確認:

- [ ] [src/engine/effect/resolver.ts](../../src/engine/effect/resolver.ts) の dispatch table に case あり?
- [ ] [src/engine/effect/atom-handlers.ts](../../src/engine/effect/atom-handlers.ts) で atom verb の handler 登録?
- [ ] **新規 verb を使う場合**: handler 追加 + engine-api-effect-descriptor.md 更新

### 4. ルール参照コメント (`// rules:`)

CLAUDE.md §共通クラス運用 で必須:

- [ ] カードファイル冒頭に `// rules: 11-reasoning.md §LP≤0` 等のルール参照コメント
- [ ] 効果に複数ルールが絡む場合はすべて記載

### 5. テスト追加

- [ ] カード単体 test (`tests/cards/<card-id>.test.ts`) で effect descriptor 構造を assert
- [ ] effect が発動する scenario の **engine 経路 test** (mutator まで通す)
- [ ] 該当 hook を使う場合、listener が登録されていれば effect → state 変化を assert
- [ ] [tests/integration/dispatch-to-state.test.ts](../../tests/integration/dispatch-to-state.test.ts) (Round 4a 新規) に該当する dispatch シナリオを追加

### 6. 自動プレイテスト (smoke) 通過

- [ ] `npm run smoke:1000` で AI vs AI で 0 例外 / 0 timeout 維持
- [ ] 新カードが少なくとも 1 度は実プレイで採用される設計 (cost / level がデッキ平均レンジ内)

### 7. Playwright 検証 (機能変更を含む round の場合)

CLAUDE.md §セルフレビュー §Playwright 1 試合通し検証 (Round 4a Phase 6.3 で追記) に従う:

- [ ] 該当カードを手札に持つ状態で実機操作し effect 発動を確認
- [ ] console error 0
- [ ] 1 試合通し (mulligan → 勝敗決定 or max 30 turn) で regression なし

### 8. リスク・バグ管理表 ([.claude/bugs/](../bugs/)) との連動 + ワークフロー図

- [ ] 既知のバグ (BUG-005 / BUG-007 等) に該当する変更の場合、該当 BUG-XXX.md の `status` を更新 + 修正 commit を `commit` プロパティに記録
- [ ] 複雑効果カードは `cards-analysis/<カードID>-workflow.md` を [WORKFLOW-GUIDELINES.md](cards-analysis/WORKFLOW-GUIDELINES.md) に準拠して作成 (BUG-064)

---

## 規約レビューフロー (CLAUDE.md §開発時の厳格レビュー手順 と連動)

1. **セルフレビュー**: 上記 1-8 を全項目チェック (本ファイルを開いて確認、todo に書く)
2. **水平展開調査**: 新規 kind / hook / verb を使う場合、同種カードが他にあるか grep + listener / handler / resolver の全件確認
3. **ユーザレビュー依頼**: 1-2 完了後にユーザへ提出、「カード追加チェックリスト完了」「水平展開調査完了」と明記

---

## 関連

- [.claude/specs/risk-and-bug-tracker.md](risk-and-bug-tracker.md) / [.claude/bugs/index.base](../bugs/index.base) — バグ管理 hub + Obsidian Base view
- [.claude/CLAUDE.md](../CLAUDE.md) / [.claude/specs/INDEX.md](INDEX.md) — 規約 + spec 一覧
- [tests/integration/dispatch-to-state.test.ts](../../tests/integration/dispatch-to-state.test.ts) — end-to-end integration test (Round 4a 新規)
