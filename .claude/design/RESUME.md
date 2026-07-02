# デザイン刷新 — 作業再開プロンプト (2026-06-19)

> カード実装の `.claude/NEXT-SESSION-PROMPT.md` とは **別track**。混同しない。

## ゴール
getdesign.md を参照に、アプリ全体(meta-app＋src 両方)の **デザイン刷新**。
手順: ① 自前 `DESIGN.md`(多テーマ・トークン) を書く → ② additive にトークン基盤→コンポーネント漸進刷新。
今は **①の前段(方向性ブレスト)** で停止中。詳細知見 = [research-findings.md](research-findings.md)。

## 確定済み (locked)
- 成果物は **まず DESIGN.md**(仕様書)。実装は後フェーズ(writing-plans)。
- 対象 = **meta-app と src を1つのトークン体系に統一**、additive。
- **多テーマ対応設計**(既定1つ＋将来スキン)。**既定テーマは未確定**。
- ファイル分割: root `DESIGN.md`(索引) ＋ `.claude/design/0X-*.md` 各 **≤100行**。

## 方向性の探索ログ (全部ユーザーに却下されている)
- ✗ 汎用4案(デジタル/ノワール/クリーン/アニメ) — コナンらしさ薄い
- ✗ 全面 **赤** — 「なぜ赤?」で頓挫。**真の所見=コナンは青基調**(下記)
- ✗ フラットな**レンガ格子** — 「ただのマス」でダサい
- ✗ **鍵穴の光** 署名(conan-keyhole-v8) — damedane
- ユーザーの要望: **しゃどば/マスターデュエル級の"カードゲームのワクワク"**。製品サイト的な地味さは不可。
- まだ刺さる署名(signature)に到達していない。

## 次セッション 最初の一手
1. 本ファイル＋ [research-findings.md](research-findings.md) を読む。
2. **`/frontend-design` を起動**(今セッションで settings に導入済=次回から Skill 可)。
   被写体に根ざした **ownable な署名を1つ**に絞る手法でやり直す(汎用デフォルト/01-02マーカー禁止)。
3. ブレスト継続 → 署名を1案ユーザー承認 → 初めて DESIGN.md 着手。
4. 視覚提案は **visual companion** を使う(下記再起動法)。flat swatch でなく署名を見せる。

## visual companion 再起動
```
bash "C:/Users/arumi/.claude/plugins/cache/claude-plugins-official/superpowers/6.0.2/skills/brainstorming/scripts/start-server.sh" --project-dir "c:/Users/arumi/OneDrive/デスクトップ/conan" --open
```
- Windows: `run_in_background:true` → 次ターンで `$STATE_DIR/server-info` から URL 取得。
- 過去モック(13枚)は `.superpowers/brainstorm/3850-1781792072/content/*.html` に永続。
  最新=`conan-keyhole-v8.html`(却下)。`conan-premium-v3.html`=プレミアム3案。`conan-brickwall-v7.html`=navy/brown壁。
- `.superpowers/` は .gitignore 済。

## 制約・運用
- 全 md **≤100行**。応答は **日本語**。トークン経済(memory: feedback-token-economy)。
- engine 凍結。刷新の真リスク = **UI hook(useActionsPanelFlow 921行/useEngineDispatch) と e2e/Playwright セレクタ結合**。
  純CSSトークンは additive で低リスク。JSX 改変は refactor Phase 3d 後＋実機検証。
- 既存トークン: `src/ui/styles/tokens.css`(ダークネイビー) / `meta-app/src/shared/tokens.ts`(重複)。統一対象。
- 関連 memory: [[project-design-roadmap]] / [[project-design-redesign-2026-06-19]] / [[feedback-design-license-stance]]。

## ブレストの状態
superpowers:brainstorming の HARD-GATE 内。**設計未承認**。承認後に DESIGN.md→自己精査→ユーザーレビュー→writing-plans。
