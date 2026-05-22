---
id: BUG-XXX
title: <短い title>
severity: <重大 | 高 | 中 | 低 | 軽微>
category: <engine | engine-listener | ui-feature | ui-text | ui-ux | ai | meta | infrastructure>
status: <未着手 | 対応中 | 修正済 | 見送り | 仕様外>
round: <Round XXX or Phase XXX or user_request YYYYMMDD_NN>
date_found: YYYY-MM-DD
date_fixed: YYYY-MM-DD (修正済 status のみ必須)
commit: <git hash> (修正済 status のみ必須、TBD は CI fail)
reporter: <user | claude | claude (session)>
related: <BUG-YYY 等の前提・関連 BUG, optional>
---

## ユーザー指摘 (or 発見契機)

> 引用 or 短い説明

## 期待動作

(公式ルール / spec / UX 期待)

## 実動作 (修正前)

(現象 + 関連 file:line)

## 関連ファイル

- `path/to/file.ts:NN` (短い説明)

## RCA (Root Cause Analysis)

(なぜ起きたか、設計・実装上の本質的な要因)

## 修正

(変更内容、code block 含む)

## 水平展開

(同 root cause が他箇所に存在しないか、調査結果)

## 検証

- vitest / E2E / smoke / typecheck の状態
- regression なし確認

## 防止策

(同種バグ再発防止の仕組み・checklist)

## 関連

- 関連 BUG (前提 / 派生)
- user_request / spec / plan へのリンク

<!--
template usage:
  cp .claude/bugs/BUG-template.md .claude/bugs/BUG-NNN.md
  各 placeholder を埋め、不要なセクションは削除。
  frontmatter 値は allowed enum のみ使用。CI で lint される。
-->
