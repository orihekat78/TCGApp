## クローン後ワンクリック 環境構築＆起動スクリプト (Windows)

**Round/Phase**: 2026-06-05 開発体験 / オンボーディング

他のユーザーがリポジトリを clone + pull した後、**`start.bat` のダブルクリックだけ**で
環境構築からゲーム起動まで自動で行えるようにした。

- **`start.bat`**（repo 直下・ダブルクリック起動・ASCII で cmd 文字化け回避）→
  **`scripts/setup-and-run.ps1`** を `-ExecutionPolicy Bypass` で実行。
- `setup-and-run.ps1` の処理:
  1. **Node.js チェック** — 未導入なら `winget install OpenJS.NodeJS.LTS` で自動導入（PATH 再読込→再確認、winget 不在時は nodejs.org を案内）。Vite 8 要件に合わせ Node 20 未満は警告。
  2. **依存インストール** — `npm ci`（fresh clone のみ。`node_modules` が lockfile より新しければスキップ）。失敗時 `npm install` でフォールバック。
  3. **起動** — 開発サーバーを別ウィンドウで起動し、`http://localhost:5173` の応答を最大60回ポーリング後、**既定ブラウザでロビーを自動オープン**。サーバーウィンドウを閉じれば停止。
- README に「クイックスタート（Windows・ワンクリック）」節を追加。
- ⚠ `setup-and-run.ps1` は日本語を含むため **UTF-8 BOM 付き**で保存（Windows PowerShell 5.1 の文字化け/parse error 回避）。BOM を剥がす編集をすると壊れる点に注意。

検証: `npm ci` 新規クローン想定インストール成功 / PowerShell parser で構文 0 error / dev サーバー起動検知ポーリング動作確認。
