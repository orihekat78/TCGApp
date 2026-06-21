# engine拡張 micro-cluster — evidence-top→hand (evidenceToHand fromTop フラグ, 1刷)

**Round/Phase**: 2026-06-21 カード追加 wave (A 継続)。前 wave (handToEvidence) の DEFER 残 B03077 を解禁。
「自分の証拠を**上から**1つ手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る」=
**evidence-top→hand**。前 wave で出荷した B06029 は「1つ**選び**」(自由 pick) だが、本カードは「**上から**」(deterministic 最上)。

## engine 変更 (1 フラグ追加、純 additive、新 verb なし)

`src/engine/effect/atom-handlers.ts` の `case 'evidenceToHand'` に **`fromTop` 分岐 1 つ**を追加。
`fromTop===true` で pick path をスキップし、証拠スタック最上 (末尾=1番上、`mutate/evidence.removeTop` が
`ev[length-1]` を top 扱いと整合) を手動 pop + `mutate.hand.add` で手札へ。**`removeTop` は使わない**
(remove エリアへ送るため。リムーブではなく手札移動)。

- **境界 (証拠0)**: no-op + `__chainStepNoApply=true` で chain break = 「そうした場合」不成立 (`filePopToHand` と同型)。
- **atom args は `args: unknown`** (effect.ts:236) → 型変更不要。**新 verb でない**ため AtomVerb union / ATOM_PICK_SPEC /
  validate / cjs whitelist の同期は不要 (`sync-taskA-whitelists.test.ts` 不変)。
- **回帰ゼロ確証**: `fromTop` を使う既存カードは 0 (新フラグ)。既存 evidenceToHand の pick path は不変。
  smoke baseline 不変 (avg 10.998 / winsA 498 / exc 0) が証跡。

## DSL (「してもよい」+「そうした場合」+「上から」の合成)

a1 = `optional{ chain[ evidenceToHand{fromTop:true}, handToEvidence{n:1} ] }` (exemplar D09010 a1 =
`optional{chain[discard, evidenceGain]}` の twin)。
- `optional` = 「してもよい」(yes/no)。**fromTop は deterministic** ゆえ B06029 の pick-0 decline が使えない →
  外側 `optional` が唯一の decline 経路。
- `chain` = 「そうした場合」(step1 が証拠0 で no-op → `__chainStepNoApply` → step2 break)。
- step2 `handToEvidence{n:1}` = 「得る」=必須 (rules/15)。公式Q&A「証拠から加えたカードをそのまま証拠化可」→
  step2 は手札全体 (step1 で加えた分を含む) から pick で自然に充足。

## 追加カード (1 base / 1 刷、ALL_CARDS 1368 → 1369、P 変種なし)

- **B03077 水無怜奈** (赤 L4 AP4000 LP1 アナウンサー、C):
  「【登場時】自分の証拠を上から1つ手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。
   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。」
  - a1 = `triggered{enter,selfOnly}` + `optional{chain[evidenceToHand{fromTop:true}, handToEvidence{n:1}]}`。
  - a2 = `triggered{evidence:remove-by-action,optional}` + `draw{n:1}` (exemplar D01003 a2 twin)。

## 検証

- tsc clean。vitest full **2739 pass / 1 skip / 0 fail** (前 baseline 2731 から +8 = 新 decoy、減なし)。
- smoke:1000 **exceptions=0・baseline 不変** (avg=10.998 / winsA=498) = engine-additive 回帰ゼロ証跡。
- playwright **120 pass / 1 skip / 1 fail** (spectator-speed:79 は既知の timing flake、単独再実行で~40%失敗だが
  B03077 は非MVP で MVP smoke/spectator デッキに不在 + fromTop 分岐は `fromTop:true` 以外で dormant = code-path 非交差。
  本変更と無関係)。
- 新規 `tests/cards/evidence-top-to-hand.test.ts` **8 件** (実 engine 駆動): §1 ★上から=末尾(最上)★ decoy
  [E_BOTTOM, E_TOP] で E_TOP のみ手札 (下からではない 1対1 witness) / §2 ★境界:証拠0★ no-op +
  `__chainStepNoApply=true` / §3 残り証拠順序保持 / §4 ★swap opt-in★ a1 を optionalRun:true で実 engine 駆動
  (fromTop→handToEvidence pick→AI drain) net 不変・上から固定 / §5 chain break opt-in/0証拠 / §6 opt-out decline /
  §7 出荷カード構造突合。
- **敵対verify (opus、refute lens)**: **OVERALL SHIP / 9点 全 ok / refute 0**。上から=正しい配列端 (mutate/evidence)、
  optional decline (human surface / AI skip=合法 passive)、chain break (__chainStepNoApply trace)、forced/optional split
  (rules/15)、Q&A 同札再証拠化、step1 後 step2 forced 充足、ヒラメキ draw refresh (BUG-036)、全 card field、全句被覆 を確証。

## 学び (恒久)

- **engine拡張 micro-cluster の clean yield は逓減**: ㉘ distinct-name-count=2base → ㉙ handToEvidence=1base →
  ㉚ evidence-top→hand=**1base**。単一 additive gate の clean yield は 1base 級が現実 (engine変更0 は完全枯渇)。
- **「上から」= deterministic top は free pick と別 verb 経路**: 「N枚から選び」(pick) と「上から N 枚」(deterministic)
  は engine 上別物。後者は pick をスキップする専用分岐 + chain-break を明示設定する必要がある (filePopToHand 同型)。
- **decoy の「上から」witness は下端カードを置く**: §1 で E_BOTTOM (下) を残し E_TOP (上) のみ取れることを 1対1 確認。
  「上から=top」を実 engine で踏むには両端に decoy を置いて配列のどちら端を取るか可視化する。
