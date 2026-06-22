# bugs: 未解決 BUG-133〜136 を一括解消 (検証 / 見送り / reorder UI)

**Round/Phase**: 2026-06-22 bug 一括解消セッション。wave#2 audit (2026-06-12) で起票された
未解決 4 件 (BUG-133/134/135/136) を systematic-debugging で根因確定し、各々を解消した。

## BUG-133 (drainAiEffectPicks の player guard) — 検証のみ (既解消)

起票後の **BUG-138 (X8)** で求められた player guard が実装済であることを確認。humanSide 所有の
pending は queue 温存・useOppTurnDriver が modal 転送/再開。既存 `bug-138-drain-ownership.test.ts`
(6 ケース) が網羅。新規 engine 変更なし。

## BUG-135 (sequence 中間 skippable pick の skip-drop) — 検証 + 回帰ガード (既解消)

起票後の **BUG-111 #2** で skip 経路が origin-kind gate (sequence-origin remainder は実行 /
chain-origin は gate) に再設計済であることを確認。決定論 scan で実出荷の該当形は PR155/PR161/D03002
のみと特定し、実カード回帰ガード `tests/cards/bug-135-sequence-middle-skip.test.ts` (3 ケース) を追加。

## BUG-134 (triggered entry pick の発動時確定) — scan → 見送り

probe で「effect:declared 以外の全 hook の pick は発動時 (queue 時) の盤面で確定」を確認。実害を分類:
害B (先行が候補を追加 → 後続が選べない) は turn-end で sceneEnter する出荷カードが 0 件で構造的に
実在せず、害A (削除/スタンの stale) は splice 防御で適用結果が rules-correct な no-op (rules/25 整合)。
rules 違反の shipped manifestation なし + engine 全面 fix は骨格凍結 risk 過大なため見送り、機構を
`tests/engine/effect/bug-134-cofire-pick-staleness.test.ts` で pin。

## BUG-136 (deckToBottomBound「好きな順番でデッキの下に移す」未 surface) — reorder UI 実装

公開順固定だった「残りを好きな順番でデッキの下に移す」の順序選択を human に surface:

- engine: `deckToBottomBound` / `souza` (捜査X、水平展開) が **human 所有 & 2 枚以上**を底へ移したとき
  side-channel `__pendingDeckReorderSide` を set (AI/spectator/smoke は __humanPlayerSide が当該 player
  でないため byte-equal)。配置後の follow-up 決定で mid-resolution pause なし。
- store: `pendingDeckReorder` + `deckReorderResolve` dispatch (底ブロックを選んだ順に再配置、
  multiset 検証付き)。
- UI: `DeckReorderModalHost` (drag + ▲▼ fallback)。useOppTurnDriver が decision modal として待機/再開。
- test: engine/dispatch unit 8 ケース + e2e (▲▼ 並べ替え / HTML5 drag) 2 ケース。

検証: vitest 2783 pass / 1 skip / 0 fail、tsc 0、lint 群 0 err、e2e 2/2 green、console error 0。
