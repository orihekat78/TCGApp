# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Phase 9-A〜9-E クローズ達成済 (2026-05-17)。
次フェーズの作業を開始したい。

## 完了状態

**Phase 9-E クローズ達成** ✅ (9-A〜9-E 一気通貫 / 1399 PASS / 185 files / typecheck clean)

- Phase 0-8 完全クローズ達成済 (engine + 47 カード + UI シェル + E2E)
- 9-A (`e4878ba`〜`3fa7fcc`): 1000戦 smoke baseline
- 9-B (`8490fd0`〜`2635c9a`) + hotfix (`e74b16e`):
  engine 4 バグ修正 (clearNamed / handUseCard char deploy / AI cost picker / Heuristic NextHint gate)
  + node:fs を browser bundle から分離
- 9-C (`ea165e6`): カード画像 UI 統合 (CardArt + useCardImage + onError fallback)
- 9-D (`37d0371`): case 向き auto-detect / partner 拡大 / hand 色あせ / Remove 画像 / Evidence↔FILE swap
- 9-E (`76681f6`): deck low-stock / FILE progress-7 完了 / opp 手札 mini back 統一

## 1000戦 smoke (現状ベースライン)

- 構成: heuristic × heuristic / 3 deck pairing
- 結果: 1000 戦完走 / 20.6s → 3.4s に短縮 / **0 例外 / 0 timeout**
- 勝率: A 52.4% vs B 47.6% / 平均 10.35 ターン

## 残課題 (本セッションで選んでください)

### scope-out from 9-C〜9-E

- **C**: demo (turn-4) fixture の cardId 不整合
  (`'0499'` 形式 → `'D08003'` 等の正規 ID に修正、デモでも画像表示)
- **D**: HandZone 内 D08015/D08019 React key 重複 warning
  (map() key を `${cardId}-${index}` 等に一意化)

### Phase 5 advance

- 実カード追加 (CT-D08/D11 以外、または同セット未実装カード)
- Misread / Souza / SceneSwitch の engine 統合 (Phase 5 prep として infrastructure のみ完成済)
  1. Misread (rules/13): reasoning per-step dispatch 化 → human defender modal 実発動
  2. Souza (rules/13): engine 'souza' atom 追加 + listener + dispatch
  3. SceneSwitch (rules/20): sceneSwitch effect で removeUid を user pick できる経路
  4. Hirameki: 実カード経由の action[case] フロー結合

### Phase 9 継続

- **9-F**: HeuristicPolicy さらなる強化 (MCTS / 重み付け scoring)
- **9-G**: ローカル保存・リプレイ機能 (localStorage / IndexedDB)
- **9-H**: パフォーマンス計測 (ターン時間 / メモリ)

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認
2. `git log --oneline -20` で 9-A〜9-E の commit を確認
3. `.claude/sessions/2026-05-17-2.md` で前セッションの全体像を把握
4. 上記候補から 1 つ選んで brainstorming → plan → 実装
5. UI 編集を含む場合は **Playwright screenshot + console error 確認** を必ず挟む
   (mem-feedback-ui-screenshot-verification)
6. CLAUDE.md §README.md 運用義務に従い、各フェーズ完了時に README 更新

## エッジケース (CLAUDE.md §設計レビュー)

- Phase 5 advance 時: touched files ≤ 3 制約 / カード単位
- engine 触る場合: §骨格凍結原則 §例外条件 (バグ修正のみ) を厳守
- UI 編集: prefers-reduced-motion 対応 / aria-label 維持
```

---

## 参考

- 直近 commit: `76681f6` (Phase 9-E) — origin/main 同期済
- ベース: 1399 PASS / 185 files / typecheck clean / docs:check clean
- 主要レポート:
  - `.claude/reports/smoke-2026-05-17.md` — 9-A baseline (engine バグ前)
  - `.claude/reports/smoke-2026-05-17-phase9b.md` — 9-B 修正後
  - `.claude/sessions/2026-05-17-2.md` — Phase 9 一気通貫の詳細
- Playwright screenshot 集: `.playwright-mcp/phase9{c,d,e}-*.png`
