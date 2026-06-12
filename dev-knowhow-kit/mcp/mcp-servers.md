# MCP サーバ構成（conan プロジェクトで使用中）

> 現状は **ユーザーレベル**（`~/.claude.json` の `mcpServers`）に登録されているため、
> 同じ Windows ユーザーなら他フォルダでも **既にそのまま使える**。
> 別マシン / 別ユーザーへ移す場合のみ下記コマンドで再登録する。

## サーバ一覧と用途

| サーバ | パッケージ | 用途 |
|--------|-----------|------|
| context7 | `@upstash/context7-mcp` | ライブラリ/フレームワークの最新ドキュメント取得（React, Vite 等の API 確認） |
| playwright | `@playwright/mcp@latest` | ブラウザ実機操作。UI 検証・E2E 的な手動確認・スクリーンショット |
| github | `@modelcontextprotocol/server-github` | PR / Issue / リポジトリ操作（要 PAT） |
| obsidian | `@modelcontextprotocol/server-filesystem` | Obsidian vault へのファイルアクセス（bugs/index.base 等の閲覧編集） |

## 再登録コマンド（別マシン用）

```powershell
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp
claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest
claude mcp add --scope user github --env GITHUB_PERSONAL_ACCESS_TOKEN=<あなたのPAT> -- npx -y @modelcontextprotocol/server-github
claude mcp add --scope user obsidian -- cmd /c npx -y @modelcontextprotocol/server-filesystem "C:\Users\<user>\obsidian-vault"
```

- **PAT は環境変数か入力時指定にし、共有ファイルに平文で書かないこと**
  （このキット作成時、`~/.claude.json` に平文 PAT が見つかった。漏えい扱いとして
  GitHub 側で revoke → 再発行を推奨）
- obsidian は実体としては filesystem サーバ。vault のパスは環境に合わせて変更

## プロジェクト単位で持ちたい場合

同梱の [.mcp.json](.mcp.json) を新プロジェクトのルートにコピーすれば、
そのプロジェクトだけで有効な project-scope 設定になる（ユーザーレベルと重複可）。

## プラグイン（MCP とは別系統、ユーザーレベルで導入済み）

| プラグイン | マーケットプレイス | 提供物 |
|-----------|------------------|--------|
| superpowers v5.1.0 | `anthropics/claude-plugins-official` | TDD / debugging / brainstorming 等のプロセススキル群 |
| claude-mem v12.0.1 | `thedotmack/claude-mem` | セッション横断メモリ（観測の自動記録・検索） |
| obsidian v1.0.1 | `kepano/obsidian-skills` | Obsidian Markdown / Bases / Canvas 編集スキル |

別マシンでの導入:

```text
/plugin marketplace add anthropics/claude-plugins-official → superpowers を install
/plugin marketplace add thedotmack/claude-mem            → claude-mem を install
/plugin marketplace add kepano/obsidian-skills           → obsidian を install
```
