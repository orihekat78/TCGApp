## Task A batch#2 wave1 — look-N→手札 クラスタ 11 枚 (engine変更0)

**Round/Phase**: 2026-06-10 session — engine変更0 カードバッチ (Task A) batch#2 wave1。

Task A green候補 (266 sig / 348 枚) の刈り取り本体に着手。**「デッキ上から N 枚見て条件に合うカードを
1 枚まで手札・残りをデッキ下」(look-N→hand)** クラスタの 6 rep / **11 枚** を、すべて **settled パターンの
再録** として実装。**engine 不変** (touched: cards/ + _reuse/index.ts + tests のみ)。

### 実装 11 枚 (6 rep + 色違い/パラレル member)
- **pure look-N→hand**: B04024 (look-2 警察) / B05057 (look-2 鈴木財閥) / B06088 (look-3 警視庁) /
  B05060 (look-2 怪盗 OR マジシャン)
- **look-N→hand→discard + 【ヒラメキ】draw**: B03007 (look-4 イベント) / PR061・PR065 (look-4 警察 OR 怪盗)
- **enterSleep + look-N→hand→discard**: PR180・PR186 (スリープ登場 + look-3 FBI)
- **【相手ターン中】【現場リムーブ時】look-1→hand + 【カットイン】AP+1000**: PR084・PR090 (毛利探偵事務所)

### 流用した settled パターン (engine変更0 の根拠)
- look-N→1枚手札→残りデッキ下 = `deckRevealUntil` + `conditional(bound $matched)` + `handAddFromDeck` +
  `deckToBottomBound` (**B01013/D01013 同型**)。trait 配列 = OR (`targetFilterToPredicate` `.some`)。
- discard 連鎖「手札に加えた場合 手札1枚リムーブ」= conditional.then を `sequence[handAddFromDeck, discard]`
  に (**D01013 同型**)。
- 【ヒラメキ】draw = `evidence:remove-by-action`(optional) → `draw` (**B01011 a2 / D08013**)。
- enterSleep = `enter`(selfOnly) → `sceneSetState{$self,sleep}` (**B01011 a1**)。
- 【カットイン】AP+1000 = `effect:declared`(on-hand,optional,selfOnly) → `charModifyAP{$contact.byUid,+1000,contact}` (**D01010 a2**)。
- 【相手ターン中】【現場リムーブ時】= `condition:{turn,opp}` + `leave:to-remove`(selfOnly) フック (**D01012 同型**)。

### Task A 刈り取りインフラ (本 session 整備、今後の wave で再利用)
- `green-candidates-enriched.json` (266 rep + 348 member + 全 stats、TSV join 済) /
  `scripts/taskA-codegen.cjs` (certified spec → CardDef .ts、TSV から no/色/stat/trait 補完、trait `,|` 両 sep 分割) /
  `scripts/taskA-register.cjs` (_reuse/index.ts へ import+配列 idempotent 登録) /
  `.tmp/taskA/certify-brief.md` + `scripts/wf-certify.mjs` (clause grounding workflow、本 session は rate-limit で pilot 中断)。

### 検証 (全グリーン / 回帰0)
- typecheck clean / eslint errors 0 (変更ファイル) / full vitest **1883 pass / 1 skip / 0 fail** (前 1876 + 新規7) /
  smoke:1000 **exceptions=0 / timeouts=0** (winsA=469/winsB=531) / Playwright e2e gate 回帰0。
- 新規 flow test `tests/cards/look-n-hand-batch.test.ts`: 実 handUseCard で「登場→look-2→警察キャラ手札・非該当デッキ下」、
  実 leave:to-remove で「相手ターン中のみ look-1→手札 (自分ターンは不発)」を assert + 全 11 枚 descriptor 構造検証。
- ALL_CARDS: 979 → **990 枚** (本 wave +11。batch#2 累計 = B01011 + wave1 11枚 = 12 枚)。
