# Codex 移行設計（2026-07-11）

## 目的

Claude Code で管理していたプロジェクト資産を失わず、以後の通常作業を
Codex で行う。`.claude/`（worktrees を除き 1,486 files / 約 15 MB）を
正本として維持し、二重管理を作らない。

## 方針

- `.claude/` の rules, specs, research, bugs, sessions, reports, auto を
  移動・複製しない。Codex は既存のパスを直接参照・更新する。
- `AGENTS.md` を Codex の唯一の作業入口にし、すべての `.Codex/` 参照を
  実在する `.claude/` パスへ正規化する。
- `.agents/skills/` を Codex 向けの有効なプロジェクトスキルとし、
  `.claude/skills/` と内容一致を検証する。以後は同時更新を必須にする。
- `.claude/worktrees/` は履歴・隔離作業資産として温存し、通常作業および
  文書生成の走査対象から除外する。

## 設定対応

| Claude 資産 | Codex での扱い |
| --- | --- |
| `CLAUDE.md` | 内容を `AGENTS.md` へ統合し、Codex の自動読込対象にする |
| `settings*.json` の permissions | Codex の sandbox / 承認モデルへ置換。許可リストは移植しない |
| `settings*.json` の hooks | Codex の作業規約・完了チェックへ置換。任意コマンド hook は自動実行しない |
| `enabledPlugins` | Codex で認識済みスキルを利用。未対応機能は対応表に明記する |
| `.mcp.json` | Serena と Firecrawl を Codex 設定へ移す。資格情報は追跡対象外にする |
| Claude の model/UI 設定 | Codex のモデル・UI 設定へは移植しない（アプリ／アカウント管理） |

## 実施内容

1. `AGENTS.md` のパス・Codex 固有運用を正規化する。
2. `.codex/` に移行台帳と MCP 設定の検証手順を置く。秘密値は記録しない。
3. `.claude/skills/` と `.agents/skills/` の完全一致を検証するスクリプトを追加する。
4. 既存の `.claude/` 全資産への参照規約、worktrees の除外規約、作業ログ規約を
   `AGENTS.md` に明記する。
5. JSON/TOML を構文検査し、不正なパス表記・資格情報のハードコードを分離する。

## 安全性と検証

- 既存ファイルの移動・削除は行わない。
- ユーザーの未コミット変更とは別に、移行用ファイルだけを検証・コミットする。
- `AGENTS.md` のパス参照、スキルのハッシュ一致、設定の構文、秘密値が Git 管理外で
  あることを確認する。
- migration 後も `.claude/` を参照してカード規則・仕様・バグ台帳・作業ログを更新できる。

## 非対象

- Claude Desktop / Claude Code の個人アカウント設定、UI、モデル選択の複製。
- `.claude/worktrees/` 内のコードの統合・削除。
- 既存アプリコードおよびゲームルールの変更。
