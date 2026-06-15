# 次セッション再開プロンプト (2026-06-15 UI picker DM 化 出荷 + triage sweep 待ち)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。**UI picker はエリアカード直接選択+画像必須** (feedback-ui-direct-manipulation)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15、UI picker Direct Manipulation 化 出荷済 = origin/main d62fee69)

- engine拡張 wave#2 cluster1〜9/11/12/13/14 ✅ (ALL_CARDS 1211)。直近 = UI picker DM 化 (engine 不変・UI 層のみ)。
- UI picker DM 化: scene-char pick (sceneSetState 等 7 verb) + switch victim を **現場カード直接クリック** に統一。
  共有述語 `src/ui/services/scenePick.ts isSceneDirectPick`、EffectPickerModal は scene pick で null + fallback に画像。
  旧 SceneSwitchPickerModal 撤去。opus 3-lens 敵対設計レビュー (全 GO-with-fixes、1 blocker 反映) → 実装 →
  全 gate green (tsc0/eslint0err/vitest 2232/smoke winsA498 不動/MCP 実機 4 シナリオ err0)。
- origin 同期確認: `git log origin/main..main` 空。

## ★最優先タスク = トリアージ・スイープ (ユーザー依頼、ゴール確定用)

未実装 ~540 base カード (842 printing) を全 certify (1窓 ~20rep、3〜4窓) → 全 engine ゲートを列挙 →
「あと正確に N クラスタ」+ 共有プリミティブ先行で回帰最小のロードマップ作成。決定論 enum (gate 別候補を機械抽出) → per-card certify。
目的=ゴール地点確定 + 大型ゲート (partner-area 17/name-designation 9 等) の設計順序最適化。
- 既存 triage 結果 (残 gate landscape): `.claude/specs/engine-gate-triage-2026-06-15.md`
- certify infra = card-wave skill / scripts/wf-certify.mjs (grounding→adversarial-verify、1rep≈200k tok・SUB=8 で throttle 回避)。
- DEFERRED-INDEX (残 engine gate): `.claude/specs/DEFERRED-INDEX.md` (name-designation / partner-area 構造 / mustGuard /
  auraGrant(triggered 付与) / loseGame 等、いずれも needs-design)。

## ★follow-up 候補 (UI、低優先)
- Guard/MisreadPicker も self 現場キャラを text-only 選択する同型 UX 問題 (今回 out of scope)。contact-guard /
  相手推理防御の別フロー (pendingEffectPick 非経由・contact-store/Promise 駆動)。DM 化するなら別途設計レビュー。

## プロセス必須
- engine 変更は骨格凍結例外手続き + opus 敵対設計レビュー + 全 gate。UI 変更は MCP 実機検証 (第一選択) + 回帰。
- 1 タスク = 1 独立コミット。docs commit は `.tmp` を消してから `npm run docs` (validate-specs 用に `.tmp/certify` は mkdir で残す)。
- push は main ff-merge (compound `checkout&&merge&&push` は分割実行、classifier 拒否回避)。
- MCP playwright が「Browser is already in use」で落ちたら mcp-chrome プロセス kill + SingletonLock 削除 → 再 navigate。

## 状態 doc
- bug: .claude/bugs/index.base / defer: .claude/specs/DEFERRED-INDEX.md
- 詳細: changelog-entries/2026-06-15-11 (UI picker DM 化) / memory.md セッション⑨
```

直近セッションは UI picker Direct Manipulation 化を出荷 (origin/main d62fee69)。
**次セッションはトリアージ・スイープ (最優先)。** `/clear` で新セッション推奨。
