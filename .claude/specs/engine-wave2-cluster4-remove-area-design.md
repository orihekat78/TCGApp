# engine拡張 wave#2 cluster4 — remove-area → deck-bottom 設計 (2026-06-14、敵対3 lens 反映済)

「リムーブエリアのカードをデッキの下に移す」族を解禁。比較 triage (6 gate × opus) で
最高歩留り (6枚) × 最低リスク (既存プリミティブの near-clone) と確定。敵対設計レビュー 3 lens
(rules / edge-determinism / per-card-completeness) は全 `needs-changes`→ DSL 短縮形修正で approve。

## 出荷 6枚 (4設計) / DEFER 1枚

- B08051 / B08051P 赤井秀一 — a1【登場時】[宮野明美]∈remove で自身〚突撃〛(turn) / a2【宣言】【ターン1】cost remove→deck で自身〚ブレット〛(turn)
- B08066 / B08066P 上原由衣 — 【宣言】cost pay[sleepSelf, remove→deck(長野県警)] → 長野県警キャラに〚突撃〛(turn)
- B03059 土井塔克樹 — a1【宣言】【ターン1】cost remove→deck(白) → キャラ AP+1000(turn) / a2【ヒラメキ】remove[怪盗キッド]→手札
- B08027 長門秀臣 — 【登場時】このキャラをリムーブしてもよい→自分と相手の remove 全部を各自 deck 下 + 両 shuffle
- **DEFER B07025**: triage 誤分類。cost は sceneToDeckBottom (実装済)、effect が「cost で移したキャラの
  レベル以下」= 動的 levelMax-from-cost filter (costPaid のレベル捕捉 + dyn filter 解決) が不在。別クラスタ。

## engine 拡張 (additive 2 プリミティブ、3点 whitelist 同期)

- **新 Cost `removeAreaToDeckBottom {target, n}`** — sceneToDeckBottom の area:'remove' 版。
  canPay = candidates(remove,filter).length≥n (rules/21 全部行えなければ使用不可)。
  pay = pick n → `mutate.remove.removeFromHere` + `mutate.deck.toBottom` (自分のみ / query.side:'self')。
  UI 選択 ctx.dyn.costParams.removeAreaToDeckBottom.ids 優先、無ければ pickCandidates 先頭 n (sceneToDeckBottom 同 posture、picker は follow-up)。
  触: effect.ts(Cost) / cost/evaluate.ts(COST_KIND_MAP+canPay) / cost/pay.ts(payInner+readRemoveAreaToDeckIds) /
  ui/useActionsPanelFlow.ts(costToText) / flow/ability-activate.ts(AbilityCostParams+costParamsToDyn) /
  scripts/taskA-validate-specs.cjs(COSTS)。
- **新 AtomVerb `removeAreaAllToDeckBottom`** (B08027) — 両プレイヤーの remove 全部を各自 deck 下 → 両 deck shuffle。
  ⚠ `['self','opp']` は**絶対スロット**を意図走査 (両者対称操作。resolvePlayer しない)。
  公式Q&A: リムーブした自身も含む (sequence で sceneRemove $self が先に self.remove へ push) /
  「リフレッシュではない」= 証拠付与なし (mutate.deck.refresh 不使用、raw splice+toBottom+shuffle / rules/14/26)。
  shuffle は ctx.rng (smoke は global Math.random override で seeded、deckShuffle と同契約)。
  触: effect.ts(AtomVerb) / effect/atom-handlers.ts(runAtom) / effect/validate.ts(ATOM_VERB_MAP) / cjs(VERBS)。

## ルール整合 / 敵対レビュー反映

- rules/09・23: 「デッキの下に移す」≠ リムーブ → leave hook 不発火 (removeFromHere は素の splice、emit なし。test で pin)。
- rules/21: cost「自分の」省略 → query.side:'self' (公式Q&A「相手のカードは移せない」B08051/B08066/B03059 全件)。
- rules/15: pick-and-grant/modify は**短縮形必須** (`max:1`+inline `filter`、nested `target`/`n:{}` は hasNorMax 不成立で**無音 no-op**。BUG-130/敵対 blocker。B09032/D01006/B03012/D04005 先例突合済)。
- B08051 a1 突撃は triggered 一回 grant (scope:'turn')。条件[宮野明美]が後で消えても失わない (qAndA / continuous では不可)。
- B08027 は optional(sequence[…]) (chain は declined optional で __chainStepNoApply を立てず後続誤実行のため不可。B09084 先例)。

## 既知ギャップ (DEFER、DEFERRED-INDEX 記載)

- **B08066 leave:remove-area**: qAndA は本 cost で《諸伏高明/0585》《大和敢助/0586》の「リムーブエリアから
  離れたとき」発動を要求。engine に `leave:remove-area` hook 不在 + 反応元 B05087/B05088 未実装のため安全に DEFER
  (盤面に反応カードなし)。将来それら実装時に hook 追加 + 本 cost 再配線が必要 (B05088 が同 cost を共有)。
- UI picker first-n は複数候補時の人間選択不能 (UX 制限、rules 誤りではない。costParams 配線済で picker は drop-in 追加可)。

## 検証

- TDD/挙動 pin 12 件 (`tests/cards/cluster4-remove-area-deckbottom.test.ts`): cost(canPay self-only/pay→deck下/leave不発) /
  verb(両者drain/自己含む/空remove無throw) / B08027(optional受諾・拒否) / B08051(条件発火・decoy非発火) / B03059(cost+AP) / B08066(sleepSelf+cost+grant)。
- 全ゲート green: tsc / sync-whitelists 5/5 / full vitest **2086** (+12) / **smoke:1000 baseline 完全一致**
  (timeouts0/exceptions0/avg10.863≈10.86/winsA469 = 挙動保存の回帰証跡。新カードは MVP デッキ不在) / playwright MCP 実機 (load→mulligan→turn→end、console err 0=favicon のみ)。
