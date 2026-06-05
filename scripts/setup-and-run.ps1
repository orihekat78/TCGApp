# 名探偵コナンTCG — クローン後ワンクリック 環境構築＆起動 (Windows / PowerShell)
#
# 役割: git clone + pull 済みのリポジトリで、Node 導入チェック → 依存インストール →
#       開発サーバー起動 → 既定ブラウザでロビー(http://localhost:5173)を開く。
# 通常は repo 直下の start.bat から呼ばれる（ダブルクリック起動）。
#
# 方針: 既存環境を壊さない。Node 未導入時のみ winget で LTS 導入を試みる。

$ErrorActionPreference = 'Stop'
# スクリプトは scripts/ 配下 → 一つ上が repo ルート
Set-Location (Join-Path $PSScriptRoot '..')
$repo = (Get-Location).Path
$Url = 'http://localhost:5173/'

function Pause-And-Exit([int]$code) {
  Write-Host ''
  Read-Host 'Enter キーでこのウィンドウを閉じます'
  exit $code
}

Write-Host '====================================================='
Write-Host '  名探偵コナンTCG — セットアップ & 起動 (Windows)'
Write-Host ('  repo: {0}' -f $repo)
Write-Host '====================================================='
Write-Host ''

# ---- 1. Node.js チェック（無ければ winget で導入） ----
function Get-NodeVersion {
  try { $v = (& node -v) 2>$null; if ($LASTEXITCODE -eq 0) { return $v } } catch {}
  return $null
}
function Refresh-Path {
  $m = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = ($m, $u | Where-Object { $_ }) -join ';'
}

$node = Get-NodeVersion
if (-not $node) {
  Write-Host '[1/3] Node.js が見つかりません。winget で LTS 版の導入を試みます...' -ForegroundColor Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try {
      winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    } catch {
      Write-Warning ('winget での導入に失敗しました: {0}' -f $_.Exception.Message)
    }
    Refresh-Path
    $node = Get-NodeVersion
    if (-not $node) {
      Write-Warning 'Node を導入しましたが、現在のウィンドウでは PATH が未反映のようです。'
      Write-Host    'このウィンドウを一度閉じてから、もう一度 start.bat を実行してください。'
      Pause-And-Exit 1
    }
  } else {
    Write-Warning 'winget が利用できません。'
    Write-Host    'https://nodejs.org/ja から Node.js LTS をインストール後、start.bat を再実行してください。'
    Pause-And-Exit 1
  }
}

# バージョン下限チェック（Vite 8 は Node 20.19+ / 22.12+ を要求）
$major = 0
if ($node -match 'v(\d+)\.') { $major = [int]$Matches[1] }
if ($major -gt 0 -and $major -lt 20) {
  Write-Warning ('Node {0} は古い可能性があります（推奨: 20 以上）。動作しない場合は Node LTS に更新してください。' -f $node)
}
Write-Host ('[1/3] Node {0} / npm {1} OK' -f $node, (& npm -v)) -ForegroundColor Green
Write-Host ''

# ---- 2. 依存インストール（fresh clone のみ。最新なら skip） ----
$needInstall = $true
if (Test-Path 'node_modules') {
  if (Test-Path 'package-lock.json') {
    $lock = (Get-Item 'package-lock.json').LastWriteTime
    $nm   = (Get-Item 'node_modules').LastWriteTime
    if ($nm -ge $lock) { $needInstall = $false }
  } else { $needInstall = $false }
}

if ($needInstall) {
  Write-Host '[2/3] 依存関係をインストール中（少し時間がかかります）...' -ForegroundColor Yellow
  if (Test-Path 'package-lock.json') {
    & npm ci
    if ($LASTEXITCODE -ne 0) {
      Write-Warning 'npm ci に失敗。npm install で再試行します...'
      & npm install
    }
  } else {
    & npm install
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Warning '依存インストールに失敗しました。ネットワーク接続を確認して再実行してください。'
    Pause-And-Exit 1
  }
} else {
  Write-Host '[2/3] 依存関係は最新です（インストールをスキップ）。' -ForegroundColor Green
  Write-Host '      ※ 強制再インストールは node_modules フォルダを削除して再実行してください。'
}
Write-Host ''

# ---- 3. 開発サーバー起動 → ブラウザでロビーを開く ----
Write-Host ('[3/3] 開発サーバーを別ウィンドウで起動します（{0}）...' -f $Url) -ForegroundColor Yellow
# 別の cmd ウィンドウで dev サーバーを起動（このウィンドウを閉じてもサーバーは継続）
$devCmd = 'title Conan TCG Dev Server  (このウィンドウを閉じるとゲームが停止します) && npm run dev'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $devCmd -WorkingDirectory $repo | Out-Null

# 起動完了（5173 応答）を待ってからブラウザを開く
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { $ready = $true; break }
  } catch { Start-Sleep -Milliseconds 800 }
}

if ($ready) {
  Write-Host 'サーバー起動を確認しました。ブラウザでロビーを開きます...' -ForegroundColor Green
} else {
  Write-Warning ('サーバーの起動確認に時間がかかっています。手動で {0} を開いてください。' -f $Url)
}
Start-Process $Url

Write-Host ''
Write-Host '====================================================='
Write-Host '  完了！ブラウザで「対戦開始」を押すと遊べます。' -ForegroundColor Green
Write-Host '  ゲームは別ウィンドウのサーバーで動作中です。'
Write-Host '  終了するには、そのサーバーウィンドウを閉じてください。'
Write-Host '====================================================='
Pause-And-Exit 0
