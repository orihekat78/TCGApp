@echo off
REM ============================================================
REM  Conan TCG - one-click setup and launch (Windows)
REM  Usage: after "git clone" and "git pull", double-click this file.
REM  It checks/installs Node, installs deps (npm ci),
REM  starts the dev server, and opens the game in your browser.
REM  (All on-screen guidance is in scripts/setup-and-run.ps1)
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-and-run.ps1"
if errorlevel 1 pause
