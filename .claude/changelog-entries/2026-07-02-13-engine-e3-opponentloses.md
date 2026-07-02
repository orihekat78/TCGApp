### engine E3 増分1 — opponentLoses verb「相手はゲームに敗北する」(alt-lose 勝利ルート)

Track A1 structural、E3 (rule-rewrite / alt勝敗) の最初の engine-only 増分。
P10/P53 family (B03135/B06105/B05118/B09107) が共有するコア機構 = カード効果から
「相手はゲームに敗北する」で決着させる alt-lose 勝利ルートを追加。

- **新 AtomVerb `opponentLoses`** ([atom-handlers/misc.ts](../../src/engine/effect/atom-handlers/misc.ts) `atomOpponentLoses`):
  `winner = resolvePlayer(a.player, ctx)` (効果所有者、既定 self) で `mutate.gameResult.set(s, winner, 'alt-lose')`。
  deck-out 系と同じ **first-writer guard** (`if (s.gameResult === undefined)`) — 先着の決着を上書きしない (rules/15 即時解決)。
  パートナー【事件解決】固定ルート (`partnerSolveCase` / `mutate.partner.solveCase`) とは独立。
- **新 reason literal `'alt-lose'`** を game-result union の全 3 定義に同期:
  [types/results.ts](../../src/engine/types/results.ts) `GameResult` / [types/game-state.ts](../../src/engine/types/game-state.ts) inline / [mutate/gameResult.ts](../../src/engine/mutate/gameResult.ts) `WinReason`。
- **consumer 配線**: [ai/match.ts](../../src/ai/match.ts) が `alt-lose → 'evidence'` に写す (MatchResult.reason 狭 union、concede 同扱い) /
  [ui/VictoryOverlay.tsx](../../src/ui/components/VictoryOverlay.tsx) REASON_LABEL に「証拠隠滅」。
  ゲーム終了判定は全て winner-based truthiness → reason 非依存で無変更 (recorder は mapped MatchResult 経由で安全)。
- whitelist 同期: validate.ts `ATOM_VERB_MAP` + scripts/taskA-validate-specs.cjs `VERBS` の両方 (sync-taskA-whitelists.test が enforce)。

engine-only (consumer カードは card phase)。**純 additive** — 既存 game-over 経路 (solveCase / deck-out 6サイト) 無変更。

**gates**: tsc 0 / vitest **3729 pass +1 skip** (base 3725 + 新規 4、regression 0) /
smoke:1000 **winsA=498 不変** exceptions=0 (consumer 無 = 挙動不変を実証) / 8 lint errors=0。
probe test = [tests/cards/e3-alt-lose.test.ts](../../tests/cards/e3-alt-lose.test.ts) (§1 winner=self / §2 first-writer guard / §3 resolvePlayer 絶対解決 / §4 partnerSolveCase additivity)。

DEFER (E3 残): P10 partner【事件解決】override (partnerSolveOverride field + canWin/solveCase 分岐) /
【証拠隠滅】keyword + cost「証拠を事件レベル数リムーブ」 / P53 evidence-all-flip + evidence特徴計数 + canWin-disable / P11 partner全色+現場4 / P48 じゃんけん (A2)。
