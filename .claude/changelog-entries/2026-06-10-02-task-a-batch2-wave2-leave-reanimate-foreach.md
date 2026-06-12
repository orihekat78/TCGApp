## Task A batch#2 wave2 — leave→hand / reanimate / forEach-all クラスタ 9 枚 (engine変更0)

**Round/Phase**: 2026-06-10 session — engine変更0 カードバッチ (Task A) batch#2 wave2 (wave1 look-N 11 枚に続く)。

green候補から settled パターンのみで 9 枚を実装。**engine 不変** (touched: cards/ 9新規 + _reuse/index.ts + tests 1新規)。
spec(JSON) → `scripts/taskA-codegen.cjs` 生成、句マッピング (clause→DSL→実証元) をヘッダに記録。

### 実装カード
- **leave→hand 3 枚** — 【相手ターン中】【現場リムーブ時】handAddFromRemove (B02004 a2 同型):
  B05034 (【緑】イベント + 同効果ヒラメキ) / B07042 ([白馬探]) /
  B09015 ([円谷光彦] か Lv4[少年探偵団] = **filterAny OR**、buildShortFormPick L75 passthrough を実コード確認)
- **reanimate 5 枚** — sceneEnter from:'remove'|'hand' ± enterSleep (B02004 a1 / D08024 / B05112 / D01012 同型):
  B04007 (リムーブ→[白鳥任三郎]Lv6以下 enterSleep + ヒラメキ sleep-pick=D03013 a2 同型) /
  B03099 (**action:declare selfOnly +【ターン1】**→リムーブ→[長野県警]Lv6以下 enterSleep) /
  B03012 (leave 時 手札→[工藤新一]Lv6以下) / PR155・PR161 (登場時 手札→[灰原哀]Lv6以下 enterSleep + draw sequence)
- **forEach-all 1 枚** — PR230 ジン: 【パートナー黒】登場時 +【相手ターン中】現場リムーブ時に
  **すべてのキャラをスリープ** (B06071 同型 forEach over:{kind:'all'}→sceneSetState{$each.uid})。
  スタン維持 (rules/03) は mutate/scene.ts setState L200 の enforce を実コード確認。

### 検証 (全グリーン / 回帰0)
- 新規 `tests/cards/leave-reanimate-foreach-batch.test.ts` **10 pass**: 実 flow (leave 発火 / decoy filter 除外 /
  相手ターン gate 負例 / reanimate 0枚 no-op / from:hand enterSleep+draw / forEach 全 sleep + スタン維持 /
  パートナー色 gate 負例) + 全 9 枚 descriptor 構造。
- 学び: sceneEnter 短縮形の pick は `drainAiEffectPicks(d, new HeuristicPolicy())` を test で明示要
  (multihook-shared-limit-batch.test.ts 同型; handAddFromRemove は walk substitution で不要)。
- full vitest **1893 pass / 1 skip / 0 fail** (+10)、typecheck clean、eslint errors 0、docs 再生成済。
- smoke:1000 **exceptions=0 / timeouts=0**。Playwright e2e **115 pass / 1 skip / 0 fail**。
- ALL_CARDS: 990 → **999 枚** (batch#2 累計 21 枚、全て engine変更0)。

### 水平展開 (見送り判断の記録)
- reanimate 残 31 reps = opt-cost (「してもよい。そうした場合」) / 宣言 / multi-pick / cond-gate /
  event カード (effect:declared matcher closure 必要 = JSON codegen 対象外: B02053/D09025 等) → 次バッチ。
- vanilla / keyword-only green候補は **0** (全て実装済と確認)。
