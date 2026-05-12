# Obsidian セットアップガイド

このプロジェクトを Obsidian vault として開く手順と内部構造。

## 初回セットアップ

1. **Obsidian インストール**: <https://obsidian.md/>
2. **Open folder as vault**:

   ```text
   C:\Users\arumi\OneDrive\デスクトップ\conan
   ```

3. 「Trust author and enable plugins」を選択
4. 初回起動時に `.obsidian/` 内の設定が自動読み込みされる

## 既に設定済み (`.obsidian/`)

| ファイル | 内容 |
|---------|------|
| `app.json` | ノイズフォルダ除外 (`.tmp/`, `.superpowers/`, `.cache/`) + 相対パスリンク優先 |
| `appearance.json` | ダークテーマ |
| `core-plugins.json` | 標準プラグイン (グラフ・バックリンク・タグペイン等) |

## ナビゲーション構造 (重要)

**ハブ&スポーク + サブMOC** の2階層構造になっている:

```text
HUB.md                          ← 1ホップ目: プロジェクト中央
├── rules/INDEX.md              ← 2ホップ目: 公式ルール
├── specs/INDEX.md              ← 2ホップ目: 設計仕様
│   ├── cards-analysis/INDEX.md ← 3ホップ目: 47枚カード分析
│   └── shared-classes/INDEX.md ← 3ホップ目: 共通クラス
├── research/
│   ├── arch/INDEX.md           ← 2ホップ目: アーキテクチャ
│   ├── data/INDEX.md           ← 2ホップ目: カードデータ
│   ├── legal/INDEX.md          ← 2ホップ目: 法務
│   ├── ux/INDEX.md             ← 2ホップ目: 対戦UX
│   ├── ui/INDEX.md             ← 2ホップ目: UIレイアウト
│   ├── tutorial/INDEX.md       ← 2ホップ目: チュートリアル
│   └── decisions/INDEX.md      ← 2ホップ目: 意思決定ログ
└── plans/.../INDEX.md          ← 2ホップ目: 実装フェーズ
```

各 INDEX.md は **下位ファイルへのリンク + 関連ディレクトリの INDEX へのクロスリンク** を持つので、グラフビューが密になる。

## 推奨コミュニティプラグイン

Settings → Community plugins → Browse から:

| プラグイン | 用途 |
|-----------|------|
| **Dataview** | 「未解決決定一覧」「動的目次」など |
| **Templater** | session ログ・spec テンプレ自動化 |
| **Tag Wrangler** | タグの整理 |
| **Recent Files** | 最近開いたファイルへの素早いアクセス |

## キーボードショートカット

| 操作 | ショートカット |
|------|--------------|
| ファイル検索 | `Ctrl + O` (→ "HUB" で中央へ) |
| グローバル検索 | `Ctrl + Shift + F` |
| グラフビュー | `Ctrl + G` |
| バックリンク表示 | 右上アイコン |
| コマンドパレット | `Ctrl + P` |

## 使い方ヒント

### 出発点

- `Ctrl + O` → `HUB` で常にプロジェクト中央へ
- HUB から各 INDEX.md へ、INDEX から個別ファイルへ降りていく

### バックリンク活用

- `rules/11-reasoning.md` を開けば、推理を参照している全ファイル一覧
- 個別カード分析からそのカードを使う共通クラスを逆引き

### グラフビュー

- `Ctrl + G` で関係性を可視化
- ルール × アーキ × UX × specs の関係が一望できる
- INDEX.md がハブとなり、孤立ノードがほぼゼロ

## 注意事項

- **`.obsidian/workspace.json` は git/共有不要** (ローカルUI状態のみ)
- **`.attachments/` は画像添付用** (現状未使用)
- **Claude Code との関係**: Claude は Obsidian を使わず markdown に直接アクセス。Obsidian は **人間の閲覧用** UIレイヤ

## 拡張アイデア (今後)

- Dataview クエリで「現在の未解決decisions」を HUB.md に動的表示
- daily-notes プラグインで `sessions/` を自動生成
- カスタムCSSで `.claude/rules/` をシンタックスハイライト

## 関連

- [HUB.md](../../HUB.md) — プロジェクト中央
- [.claude/CLAUDE.md](../CLAUDE.md) — 開発規約
