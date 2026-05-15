# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```
名探偵コナンTCG MVP の Phase 8 (UI Interactions) に着手します。

## 開始前に必ず読むファイル (順序通り)

1. `.claude/CLAUDE.md` — プロジェクト規約 (骨格凍結原則 / メモリ運用 / README 義務)
2. `.claude/memory.md` — 現状サマリ + 次最優先タスク
3. `.claude/sessions/2026-05-15-2.md` — 直前セッション (Phase 7.5 layout pivot)
4. `.claude/research/plans/2026-05-11-mvp-implementation/phase-8-ui-interactions.md` — Phase 8 詳細プラン
5. `.claude/research/plans/2026-05-11-mvp-implementation/phase-7-ui-shell.md` — Phase 7 完了状態 (15/15 task ✅)

## 現在の状態

- Phase 0-7 + Phase 7.5 (layout pivot) 完了
- 1131/1131 tests pass / typecheck clean / docs:check clean
- `npm run dev` でブラウザに 13 エリア揃ったプレイマット表示 (`http://localhost:5173/`)
- 最新 commit: `cded622 refactor(ui): Phase 7.5 mat grid 再構造化`

## Phase 8 のスコープ

- ActionsPanel の各 action item に onClick + canUse 判定 + dispatch 配線
- ActionsPanel 内 cursor: not-allowed → pointer
- Phase toggle / END turn の disable 解除 + click handler
- 推理・アクション・アシスト・事件解決の確認モーダル
- カード詳細モーダル / ネクストヒント / カットイン / 変装 / ヒラメキ フロー
- DnD or click-target で対象選択 UX
- 動的 actionMode (engine 状態連動)
- 学生 tooltip の動的生成

## Phase 8 完了後の TODO (memory.md 記載済)

ユーザ参考画像との完璧な視覚一致のために layout polish をもう 1 ラウンド実施:
- カード画像実フェッチ表示 (Task 7.15 API + URL pattern 確定後)
- mat 内部の細かい寸法調整 (現状 80% 一致)
- モーダル類追加

## 進め方

Phase 7 同様、subagent-driven (Claude Code) + Claude Design dual-track の
混合戦略でいきます。視覚的に複雑なモーダル (推理確認 / コンタクト VS 演出 等) は
Claude Design に出して、操作配線は Claude Code 側で統合。

design-mockups/{02a-reasoning-prototype,02b-action-vs-prototype,03-modal-catalog,
04-animation-verification}.html が Phase 8 で活用する参考資産です。

CLAUDE.md「開発時の厳格レビュー手順」(セルフレビュー + 水平展開) を遵守してください。

まずは Phase 8 プラン (`phase-8-ui-interactions.md`) を読んで、最初の task を
提示してください。
```

---

## 補足: プロンプトを短くしたい場合 (最小版)

```
名探偵コナンTCG Phase 8 着手。`.claude/memory.md` から開始し、
`phase-8-ui-interactions.md` のプランに従って最初の task を提示してください。
Phase 7 + 7.5 layout pivot 完了済、1131 tests pass、`npm run dev` でブラウザ表示可。
進め方は subagent-driven + Claude Design dual-track 混合戦略 (Phase 7 と同じ)。
```

## 補足: スクショ参照が必要なら

ユーザ提供の参考画像 (`scratch_after_phase8_layout.png` 等) は本リポジトリには
未保存。次セッションで再添付するか、本セッションのスクショ
`phase7.5-v3.png` (gitignored、ローカル保管) を見せてください。