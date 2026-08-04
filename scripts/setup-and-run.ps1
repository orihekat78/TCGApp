# 名探偵コナンTCG — クローン後ワンクリック 環境構築＆起動 (Windows / PowerShell)
#
# 役割: git clone + pull 済みのリポジトリで、Node 導入チェック → 依存インストール →
#       開発サーバー起動 → 既定ブラウザでロビー(http://localhost:5173)を開く。
# 通常は repo 直下の start.bat から呼ばれる（ダブルクリック起動）。
#
# 方針: Node 24.x / npm 11.12.1 を必須とし、既存環境の自動更新はしない。

$ErrorActionPreference = 'Stop'
$RequiredNodeMajor = 24
$RequiredNpmVersion = '11.12.1'
# スクリプトは scripts/ 配下 → 一つ上が repo ルート
Set-Location (Join-Path $PSScriptRoot '..')
$repo = (Get-Location).Path
$apps = @(
  @{
    Name = 'ゲーム'
    Url = 'http://localhost:5173/'
    Command = 'title Conan TCG Game Server  (このウィンドウを閉じるとゲームが停止します) && npm run dev'
  },
  @{
    Name = 'デッキ編集'
    Url = 'http://localhost:5174/#home'
    Command = 'title Conan TCG Deck Builder  (このウィンドウを閉じるとデッキ編集が停止します) && npm run dev:meta'
  }
)

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
    Write-Host    'https://nodejs.org/ja から Node.js 24.x をインストール後、start.bat を再実行してください。'
    Pause-And-Exit 1
  }
}

# 固定toolchain契約。異なる版ではlockfileを再現できないため起動しない。
$major = 0
if ($node -match 'v(\d+)\.') { $major = [int]$Matches[1] }
if ($major -ne $RequiredNodeMajor) {
  Write-Warning ('Node {0} は対象外です。Node 24.x が必要です。' -f $node)
  Write-Host 'https://nodejs.org/ja から Node.js 24.x を導入して再実行してください。'
  Pause-And-Exit 1
}
$npmVersion = (& npm -v)
if ($npmVersion -ne $RequiredNpmVersion) {
  Write-Warning ('npm {0} は対象外です。npm {1} が必要です。' -f $npmVersion, $RequiredNpmVersion)
  Write-Host ('導入コマンド: npm install --global npm@{0}' -f $RequiredNpmVersion)
  Pause-And-Exit 1
}
Write-Host ('[1/3] Node {0} / npm {1} OK' -f $node, $npmVersion) -ForegroundColor Green
Write-Host ''

# ---- 2. 依存インストール（毎回lockfileからクリーン再現） ----
Write-Host '[2/3] 依存関係を確認中（少し時間がかかります）...' -ForegroundColor Yellow
if (-not (Test-Path 'package-lock.json')) {
  Write-Warning 'package-lock.json がありません。固定依存を確認できないため起動を中止します。'
  Pause-And-Exit 1
}
& npm ci
if ($LASTEXITCODE -ne 0) {
  Write-Warning 'npm ci に失敗しました。lockfileとネットワーク接続を確認してください。'
  Pause-And-Exit 1
}
Write-Host ''

# ---- 3. 開発サーバー起動 → ブラウザでゲームとデッキ編集を開く ----
Write-Host '[3/3] ゲームとデッキ編集を別ウィンドウで起動します...' -ForegroundColor Yellow
foreach ($app in $apps) {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $app.Command -WorkingDirectory $repo | Out-Null
}

function Wait-For-App([string]$url) {
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 800
  }
  return $false
}

$notReady = @()
foreach ($app in $apps) {
  if (-not (Wait-For-App $app.Url)) { $notReady += $app }
}

foreach ($app in $apps) { Start-Process $app.Url }
if ($notReady.Count -eq 0) {
  Write-Host 'ゲームとデッキ編集の起動を確認しました。ブラウザを開きます...' -ForegroundColor Green
} else {
  Write-Warning ('起動確認がタイムアウトしました。手動で開いてください: {0}' -f ($notReady.Url -join ', '))
}

Write-Host ''
Write-Host '====================================================='
Write-Host '  ブラウザでゲームとデッキ編集を開きました。' -ForegroundColor Green
Write-Host '  終了するには、各サーバーウィンドウを閉じてください。'
Write-Host '====================================================='
Pause-And-Exit 0
