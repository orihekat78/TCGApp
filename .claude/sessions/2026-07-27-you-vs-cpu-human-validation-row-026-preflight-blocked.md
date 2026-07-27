# Row 026 preflight — blocked

- Planned pair: YOU `deck-1784115364915` (緑アグロ) vs CPU
  `deck-1785077234307` (黒カットイン), desktop P1.
- Worklist remains `026,...,queued`; the row match was not started.
- Entry surfaces: public `#setup`, `#deck`, and active match UI only. No
  dispatch, state/pending injection, private-card inspection, or direct-match
  recovery was used.

## Public preflight evidence

- `#deck` showed 緑アグロ as 遠山和葉 / 恋と推理の剣道大会, 40 cards,
  15 types; its visible list is 遠山和葉・服部平次・ヘビ男・沖田総司とイベント4種。
- `#deck` showed 黒カットイン as シェリー / ブラックインパクト！, 40 cards,
  14 types; its visible list is キール・バーボン・キャンティ・ウォッカ・
  ヘルエンジェル・カルバドス・ジン・スコッチ・ラム等、イベント0種。
- The public card detail for `キール PR202` showed
  `【解決編】【登場時】手札を1枚リムーブする。カードを1枚引く。`
  and `【カットイン】AP＋1000。`.
- Fresh `#setup` recovery confirmed that both `緑アグロ` and `黒カットイン`
  remain visible selectable public decks. No match was readied or started; the
  temporary Deck Editor change was discarded without saving.

## BUG-274 Escape gate

- Supersedes the pre-fixture observations below. Public `#setup` now exposes
  select-only `TEST — BUG-274 Escape（複数能力）`; its synthetic partner is
  registered only through ordinary match start and is not persisted to decks.
- Actual public clicks: fixture select → P1 → READY → no-mulligan → partner
  ability → both labels visible → Escape. The picker closed while the route
  remained `#match`; no dispatch, state injection, or private-card access.
- Focused Playwright actual-click regression passed. BUG-274 exact
  live-browser Escape evidence is **confirmed**.

- Public `TEST-無制限0627` was started from `#setup`; after a no-mulligan
  click, its action panel showed `パートナーの能力: 能力なし`.
- Public `TEST-バグ波-緑` was also started from `#setup`; after a no-mulligan
  click, its action panel likewise showed `パートナーの能力: 能力なし`.
- Therefore the required public state with multiple executable partner
  abilities, followed by Escape, was not reachable from the available fixtures.
  This was superseded by the fixture evidence above; the exact live-browser
  Escape regression is **confirmed**.

## Gate result and next decision

- The Ver.2.5 rule-baseline/keyword conflict was resolved against the official
  PDF. `tcg:packet:build` remains fail-closed because the worktree is dirty and
  expert protocol/card coverage remain unresolved.
- Fresh public-UI baseline probe initially questioned action-source selection,
  then resolved it against `07-action-flow.md`: 吉田歩美 had the public「名」
  state and therefore was not an action candidate; the active partner only was
  correct. The probe remains incomplete but has no action-source mismatch; see
  `2026-07-27-tcg-expert-baseline-public-ui-probe.md`.
- Per the resume Gate, row 026 is `blocked-preflight`; no play decision, win,
  loss, turn count, or row status is recorded.
- Next: complete the full protocol/card-text coverage, freeze a clean packet,
  then re-open row 026.
