# 行026 開始可能性

記録日: 2026-07-27 JST

## 対象

- 行026: YOU `deck-1784115364915` vs CPU `deck-1785077234307`、Desktop P1。
- worklist行001--025、55組上三角、既存resume Gate定義は変更しない。

## 確認済み

- `main` は `829219d9` のまま。準備作業は `codex/row026-gate-prep` に隔離。
- `INDEX.md`、keyword、adapterのrule baselineはVer.2.5。版不一致は解消した。
- BUG-274の公開fixture Escape回帰は、公開 `#setup` からの実クリックとfocused Playwrightで確認済み。
- 公開UI baselineでmulligan、手札使用、Next Hint、任意使用、相手へのアクション判断、証拠進行、CPU応答を確認。
- 表向きカードは都度、公開UI本文・公式カード本文・該当規則を照合する運用にした。

## Gate

1. ユーザー指示により、cut-in・keyword・対象・任意効果を含むカード本文照合は、表向きになった各判断の直前に行026内で実施する。別対局でのex ante網羅は開始条件にしない。
2. Round 4のCPU停止は、同じaction/cut-in経路のdesktop/mobile E2E 8件で再現しなかった。行026中に公開UIで再発した場合だけ操作を止め、`blocked-ui-rule-mismatch`として記録する。
3. `main` が `829219d9`、worktreeがclean、fresh runtime packetとfresh `conan-verify`が成功していること。

既存resume Gate定義、55組上三角worklist、行001--025は変更しない。

## 次の判断

runtime packetと検証をclean worktreeで完了する。次の実操作は行026の `#setup`。worklist状態は `queued`。
