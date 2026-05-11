# Obsidian セットアップガイド

このプロジェクトを Obsidian vault として開く手順と推奨設定。

## 初回セットアップ

1. **Obsidian インストール**: <https://obsidian.md/>
2. **Open folder as vault**:
   ```
   C:\Users\arumi\OneDrive\デスクトップ\conan
   ```
3. 「Trust author and enable plugins」を選択
4. 初回起動時に `.obsidian/` 内の設定が自動読み込みされる

## 既に設定済み（`.obsidian/`）

| ファイル | 内容 |
|---------|------|
| `app.json` | ノイズフォルダ除外（`.tmp/`, `.superpowers/`, `.cache/` 等）+ 相対パスリンク優先 |
| `appearance.json` | ダークテーマ（プロジェクト基調と一致） |
| `core-plugins.json` | 標準プラグインの有効化設定（グラフ・バックリンク・タグペイン等） |

## 推奨コミュニティプラグイン

Obsidian の Settings → Community plugins → Browse から以下をインストール:

| プラグイン | 用途 |
|-----------|------|
| **Dataview** | 動的な「決定一覧」「未解決事項」表を自動生成 |
| **Templater** | セッション開始時の memory.md テンプレ挿入 |
| **Excalidraw** | 手書きの図解（オプション） |
| **Tag Wrangler** | タグの整理 |
| **Recent Files** | 最近開いたファイルへの素早いアクセス |

## 主要キーボードショートカット

| 操作 | ショートカット |
|------|--------------|
| ファイル検索 | `Ctrl + O` |
| グローバル検索 | `Ctrl + Shift + F` |
| グラフビュー | `Ctrl + G` |
| バックリンク表示 | 右上アイコン or `Ctrl + Click` |
| コマンドパレット | `Ctrl + P` |
| HUB.md 即開 | `Ctrl + O` → `HUB` |

## 使い方ヒント

### 出発点
- **HUB.md** をホームページ的に常時開いておく
- すべての主要ドキュメントへのリンクが集約済み

### バックリンク活用
- 任意のファイルの右上「リンクアイコン」で被参照を確認
- 例: `rules/11-reasoning.md` を開けば、推理を参照している全ファイル一覧

### グラフビュー
- `Ctrl + G` で関係性を視覚化
- ルール × アーキ × UX の関係性が見えるとプロジェクト全体像を俯瞰可

### 検索
- `tag:#rule` のようなタグ検索（タグ追加すれば）
- 全文検索で「アシスト」「コンタクト」など即座にヒット

## 注意事項

- **`.obsidian/workspace.json` は git/共有不要**: ワークスペースのウィンドウ位置などローカル状態
- **`.attachments/` は画像添付用**: 現状未使用、必要時のみ自動作成される
- **Claude Code との関係**: Claude は Obsidian を使わず、markdown ファイルに直接アクセス。Obsidian は **人間の俯瞰用** のUIレイヤ

## 拡張アイデア（後段）

- Dataview クエリで「現在の未解決decisions」を HUB.md に動的表示
- daily-notes プラグインで `sessions/` を活用
- カスタムCSSで `.claude/rules/` をシンタックスハイライト

## 関連
- [HUB.md](../../HUB.md)
- [.claude/CLAUDE.md](../CLAUDE.md)
