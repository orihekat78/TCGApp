@echo off
REM ============================================================
REM  名探偵コナンTCG Web アプリ ワンクリック起動バッチ
REM    - メインアプリ      : http://localhost:5173/
REM    - meta-app (deck)   : http://localhost:5174/#home
REM  2 つの Vite dev サーバを別ウィンドウで起動し、
REM  起動完了を待ってからブラウザでそれぞれ開く。
REM ============================================================

REM このバッチが置かれているフォルダへ移動
cd /d "%~dp0"

echo [1/3] dev server を起動しています...

REM メインアプリ (5173)
start "conan main (5173)" cmd /k "npm run dev"

REM meta-app デッキビルダー (5174)
start "conan meta (5174)" cmd /k "npm run dev:meta"

echo [2/3] サーバ起動待機中 (8 秒)...
timeout /t 8 /nobreak >nul

echo [3/3] ブラウザで開いています...
start "" "http://localhost:5173/"
start "" "http://localhost:5174/#home"

echo.
echo 完了しました。dev server は別ウィンドウで動作中です。
echo 終了するには各 dev server ウィンドウを閉じてください。
echo.
