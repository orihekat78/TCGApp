# Dual-app launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the game and the deck-builder app from `start.bat`, then open both only after each responds.

**Architecture:** Keep `start.bat` as a thin PowerShell entry point. Extend `scripts/setup-and-run.ps1` with two named app records, one process per Vite server, and a shared bounded readiness poll.

**Tech Stack:** Windows batch, PowerShell 5+, npm, Vite.

## Global Constraints

- Preserve Node installation and dependency-install behavior.
- Main app URL is `http://localhost:5173/`; deck-builder URL is `http://localhost:5174/#home`.
- Do not kill existing user processes.
- Timeout must show both manual URLs and return a successful launcher result.

---

### Task 1: Start and verify both local apps

**Files:**
- Modify: `scripts/setup-and-run.ps1:14,97-132`
- Test: direct PowerShell static assertions

**Interfaces:**
- Consumes: `npm run dev`, `npm run dev:meta`, Vite ports 5173 and 5174.
- Produces: two `cmd.exe` windows and browser navigation to both local URLs.

- [ ] **Step 1: Write the failing launcher contract check**

Run:

```powershell
$script = Get-Content -Raw scripts/setup-and-run.ps1
@('http://localhost:5173/', 'http://localhost:5174/#home', 'npm run dev:meta', 'Invoke-WebRequest') |
  ForEach-Object { if ($script -notmatch [regex]::Escape($_)) { throw "missing: $_" } }
```

Expected: FAIL because the 5174 URL and `npm run dev:meta` are absent.

- [ ] **Step 2: Add a two-app startup table and readiness helper**

Replace the current single `$Url`, `$devCmd`, readiness loop, and browser launch with:

```powershell
$apps = @(
  @{ Name = 'ゲーム'; Url = 'http://localhost:5173/'; Command = 'title Conan TCG Game Server  (閉じるとゲームが停止します) && npm run dev' },
  @{ Name = 'デッキ編集'; Url = 'http://localhost:5174/#home'; Command = 'title Conan TCG Deck Builder  (閉じるとデッキ編集が停止します) && npm run dev:meta' }
)

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

$notReady = @($apps | Where-Object { -not (Wait-For-App $_.Url) })
foreach ($app in $apps) { Start-Process $app.Url }
if ($notReady.Count -eq 0) {
  Write-Host 'ゲームとデッキ編集の起動を確認しました。ブラウザを開きます。' -ForegroundColor Green
} else {
  Write-Warning ('起動確認がタイムアウトしました。手動で開いてください: {0}' -f ($notReady.Url -join ', '))
}
```

- [ ] **Step 3: Re-run the contract check**

Run the Step 1 command again.

Expected: PASS with no output.

- [ ] **Step 4: Validate PowerShell syntax**

Run:

```powershell
$tokens = $null; $errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path scripts/setup-and-run.ps1), [ref]$tokens, [ref]$errors) | Out-Null
if ($errors) { $errors | Format-List; exit 1 }
```

Expected: exit code 0.

- [ ] **Step 5: Inspect launcher diff and check horizontal sibling**

Run:

```powershell
git diff --check -- start.bat start-apps.bat scripts/setup-and-run.ps1
Get-Content -Raw start-apps.bat
```

Expected: no whitespace errors; `start-apps.bat` remains a non-user-facing legacy launcher or is aligned only if it would otherwise misrepresent the supported flow.
