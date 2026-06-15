# 次セッション再開プロンプト (2026-06-15 cluster14 出荷 + UX 改修待ち)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。**UI picker はエリアカード直接選択+画像必須** (feedback-ui-direct-manipulation)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15、cluster14 出荷済 = origin/main 1abe3fdb)

- engine拡張 wave#2 cluster1〜9/11/12/13/**14** ✅。ALL_CARDS = 1211。origin 同期確認 (`git log origin/main..main` 空)。
- 直近 = cluster14 (multi-card sceneEnter「2枚まで登場」B09010/P+PR042/PR046 4枚)。triage→opus 3-lens 敵対設計レビュー
  (3 blocker+7 fix 反映)→実装→全 gate green (tsc0/vitest 2226/smoke winsA498 不動/playwright 119+MCP 実機 err0)。

## ★最優先タスク = UI picker の Direct Manipulation 化 (ユーザー強い指摘、player-facing 必須)

cluster14 の MCP 実機でユーザーが「ピッカーが text-only で同名カード(吉田歩美×3)が区別不能・現場カードを直接選べない」と指摘。
**原則 (memory feedback-ui-direct-manipulation): エリア内カードの pick は実際の現場カードを直接クリック (Direct Manipulation) させる=必須。
選択肢にカード画像 (Recognition over Recall)。text-only リスト不可。** cluster14 同等の rigor で実施:

### 対象2 picker (どちらも現場=エリアカード → 直接選択必須)
1. **EffectPickerModal** (`src/ui/components/EffectPickerModal.tsx`) — scene-char target の fallback text リスト (自/相 badge、画像なし)。
   `sceneSetState` 等 AREA_PICK_VERBS 外の scene-targeting verb がここに落ちる。
2. **SceneSwitchPickerModal** (`src/ui/components/SceneSwitchPickerModal.tsx` + `useSceneSwitchPickerStore.ts`) — switch victim
   (self 現場) を text リスト化。cluster14 の onPickMulti (Playmat ~818) が overflow 時に loop 起動している。

### 既存の直接選択機構 (これを拡張流用 = "この処理はどこかにあるはず" の正体)
- **Playmat `isScenePick`** (`src/ui/components/Playmat.tsx` ~368): pending が `sceneRemove`/`charModifyAP` のとき
  SceneArea のカードを `effect-pickable` (黄ハイライト) 化 + クリックで `handleScenePick` → effectPickResolve。**現状 self 現場のみ**。
- `SceneArea.tsx` ~111 `effect-pickable` class。
- 画像: `useCardImage` hook (IMAGE_BASE+def.imageUrl) / `CardArt.tsx` (onError→placeholder)。裏向き証拠は card-back。

### 設計方針 (要 opus 設計レビュー)
- scene 直接 pick (`isScenePick`) を **全 scene-char-targeting verb (sceneSetState 等) + 自他両現場クリック** に拡張し、
  EffectPickerModal の scene fallback を置換。switch victim も同機構 (現場クリック) で収集 (SceneSwitchPickerModal 廃止 or 画像化)。
- modal 不可避なケース (非エリア/mixed) のみ画像付き modal を残す。
- 進め方: 設計 doc → opus 3-lens 敵対設計レビュー → 実装 → **MCP 実機検証 (同名 decoy を盤面に置き直接選択+画像識別を確認)** →
  回帰 (vitest/smoke 不動/playwright)。骨格凍結例外不要 (UI 層のみ、engine 不変)。

## ★その後 = トリアージ・スイープ (ユーザー依頼、ゴール確定用)

未実装 ~540 base カード (842 printing) を全 certify (1窓 ~20rep、3〜4窓) → 全 engine ゲートを列挙 →
「あと正確に N クラスタ」+ 共有プリミティブ先行で回帰最小のロードマップ作成。決定論 enum (gate 別候補を機械抽出) → per-card certify。
目的=ゴール地点確定 + 大型ゲート (partner-area 17/name-designation 9 等) の設計順序最適化。

## プロセス必須
- engine 変更は骨格凍結例外手続き + opus 敵対設計レビュー + 全 gate。UI 変更は MCP 実機検証 (第一選択) + 回帰。
- 1 タスク = 1 独立コミット。docs commit は `.tmp` を消してから `npm run docs` (validate-specs 用に `.tmp/certify` は mkdir で残す)。
- push は main ff-merge (compound `checkout&&merge&&push` は分割実行、classifier 拒否回避)。

## 状態 doc
- triage 結果 (残 gate landscape): `.claude/specs/engine-gate-triage-2026-06-15.md`
- bug: .claude/bugs/index.base / defer: .claude/specs/DEFERRED-INDEX.md (multi-card sceneEnter ✅)
- 詳細: changelog-entries/2026-06-15-10 (cluster14) / memory.md セッション⑧
```

直近セッションは triage→cluster14 (multi-card sceneEnter) 出荷 (origin/main 1abe3fdb)。
**次セッションは UI picker の Direct Manipulation 化 (最優先) → トリアージ・スイープ。** `/clear` で新セッション推奨。
