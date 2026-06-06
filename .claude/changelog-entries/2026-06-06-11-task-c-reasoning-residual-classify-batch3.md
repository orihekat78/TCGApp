## タスク C: reasoning 残 全数分類 + reasoning-hook batch #3 (B05039 / B03096、engine 変更0)

**Round/Phase**: 2026-06-06 session — タスク C 第6弾。user 指示「reasoning 残 ~11 を1枚ずつ『既存hookで動くか/
新機能要か』分類してから着手」。多エージェント workflow (10 並列) で全数を engine コード突合分類し、
**既存 hook だけで忠実実装できる 2 枚** を engine 変更0で実装。

### reasoning 反応カード 全 13 枚の分類 (workflow + 一次調査で確定)

実装済 (前バッチ): B01017/B01074 (selfOnly) / B03102/B05011 (triggerCharMatches)。残 13 枚の内訳:

- **既存 hook で実装可 (2 枚、本バッチ)**: B05039 / B03096。
- **partial (非 reasoning ability のみ既存可)**: B08034(+P) (【登場時】可 / 推理反応は set-card 除去 verb 要) /
  B02004(+D10023/PR173) (【現場リムーブ時】可 / 推理かアクションは multi-hook 共有 limit 要) /
  B05080 (ミスリード可 / 推理反応は triggerChar→target binding 要)。
- **new-feature 必須**: B05019 (optional 決定配線。trigger+LP pick は既存、「リムーブしてもよい」が blocker) /
  B03038 (evidence 抑制 + optional) / B04039 (multi-hook 共有 limit + action triggerChar) /
  B09047 (partner-area MR 2色 condition + データ無) / D03007 (multi-hook 共有 limit)。

### 対応カード (2 枚)

- **B05039 松田左文字** (緑Lv4): このキャラ推理時、Lv5を2枚まで+Lv7を1枚まで選び AP+1000 turn。
  reasoning:end selfOnly + sequence([charModifyAP PA 短縮形 ×2、levelMin==levelMax で exact level、side:'either'])。
  multi-target は apply-pick が pickedUids を per-char 適用 (B02021 同型)。人間=multi-select modal / CPU=drainAiEffectPicks。
- **B03096 目暮十三** (黄Lv4): 【ターン1】自分の現場のキャラ推理時、捜査1 + Lv8以上発見で1ドロー。
  reasoning:end + triggerCharMatches{self} + limit turn:1。souza atom は「発見」を bind 不可のため
  **deckRevealUntil(player:'opp', maxN:1, filter levelMin:8)** で捜査1を代替 (B01017 deck-look-N 同型)、
  $found matched で conditional draw、deckToBottomBound で公開札を相手デッキ下へ。

### 検証

- typecheck clean / 全 vitest **1827 pass / 1 skip / 0 fail** (+5、回帰0) / docs:check 同期 /
  lint (listener/bugs/side-channel) errors=0。
- unit `tests/cards/reasoning-hook-batch3.test.ts` 5 件 (multi-target Lv5×2+Lv7 / decoy除外 / Lv8発見ドロー / Lv7非発見)。
- e2e `tests/e2e/reasoning-hook-batch3-2026-06-06.spec.ts` 3 pass (人間経路 text-faithfulness):
  pick#1=Lv5のみ(2枚)/pick#2=Lv7両現場(1枚まで)/選択札+1000・decoy不変 (side:'either' 検証) ・
  捜査1 Lv8発見ドロー+デッキ下 / Lv7非発見。console error 0。
- ALL_CARDS 955 → **957** (+2、重複 ID なし)。

### 残課題 (reasoning 残 11 枚 = partial 3 + new-feature 4 + reprint)

次に最も解禁が大きい新機能候補: **optional 決定の配線** (pendingOptional、B05019 完全解禁 + 多数の「〜してもよい」に波及) /
**multi-hook 共有 limit** (D03007/B04039/B02004 の推理かアクション) / **triggerChar→target binding** (B05080)。
詳細は session log 参照。
