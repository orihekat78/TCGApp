# engine拡張 micro-cluster — handToEvidence (手札→裏向き証拠 verb, 2刷)

**Round/Phase**: 2026-06-21 カード追加 wave (A 継続)。前 wave (distinct-name-count) 出荷後、`.tmp/gate-yield-scan.cjs`
で次弾 micro-cluster を再 scan。**evidence⇔hand swap** (「証拠を1つ選び手札に加えてもよい。そうした場合、手札から
カードを1枚裏向きで証拠として得る」) を engine拡張 micro-cluster 化。前回 handoff の「2 verb」見積りは誤りで、
`evidence→hand` は既存 `evidenceToHand` で充足 → **新 verb は `handToEvidence` 1つのみ**。

## engine 変更 (1 verb 追加、純 additive)

`src/engine/effect/atom-handlers.ts` に `case 'handToEvidence'` (PB pick、defaultArea 'hand') を追加。
手札から pick した 1 枚を `mutate.evidence.gainCard(... 'none')` で証拠へ push (裏向き既定)。**4 点同期**:
AtomVerb union (`types/effect.ts`) / `ATOM_PICK_SPEC` (`atom-pick-spec.ts`) / `ATOM_VERB_MAP` (`validate.ts`) /
cjs whitelist (`taskA-validate-specs.cjs`) — `sync-taskA-whitelists.test.ts` が同期を機械保証。

- **手札在庫ガード**: target が手札に無ければ no-op (証拠を湧かせない)。decoy §3 が捕捉した実バグの修正込み。
- **faceUp 既定 false** (「裏向きで証拠として得る」)。**push = 証拠1番上** (公式Q&A B06029「手札から裏向きで得る証拠は
  1番上に置かれます」、`mutate/evidence.removeTop` が `ev[length-1]` を top 扱いと整合)。
- **回帰ゼロ確証**: 既存カードで `handToEvidence` を使うものは 0 (新 verb)。`evidenceToHand` 等の既存 verb は不変。
  smoke baseline 不変 (avg 10.998 / winsA 498 / exc 0) が証跡。
- **chain semantics** (「〜してもよい。そうした場合〜」) = `chain[evidenceToHand max:1, handToEvidence n:1]`
  (exemplar D08003 a1 `chain[discard, sceneRemove]`)。step1 が no-op (証拠0 / 0枚 decline) なら `__chainStepNoApply`
  で step2 skip。新 verb は chain 機構に非依存 (verb-agnostic break) のため、出荷済 D08003 と同じ経路で動作。

## 追加カード (1 base / 2 刷、ALL_CARDS 1366 → 1368)

- **B06029 / B06029P ヘビ男** (緑 L3 AP3000 LP1 YAIBA、C/CP):
  「【登場時】自分の証拠を1つ選び、手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。
   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。」
  - a1 = `triggered{enter,selfOnly}` + `effect chain[evidenceToHand{max:1}, handToEvidence{n:1}]`。
  - a2 = `triggered{evidence:remove-by-action,optional}` + `sceneSetState{player:self,state:sleep,max:1,side:either}`
    (PA pick-carrier 短縮形、BUG-130 準拠。「1枚まで」=max:1=0可、side either=text 無制限)。exemplar D03013 / D08013 a2。
  - B06029P = B06029 spread (rarity CP / imageUrl のみ差、テキスト byte 同一)。

## 検証

- tsc clean。vitest full **2731 pass / 1 skip / 0 fail** (前 baseline 2724 から減なし)。
- smoke:1000 **exceptions=0・baseline 不変** (avg=10.998 / winsA=498) = engine-additive 回帰ゼロ証跡。
- playwright **123 pass / 1 skip** (spectator-speed の 1 fail は単独再実行 3/3 pass = flaky 確定、本変更と無関係)。
- 新規 `tests/cards/hand-to-evidence.test.ts` **12 件** (実 engine 駆動): §1-3 `handToEvidence` runAtom (move/faceUp/
  top配置/在庫ガード) / §4 evidence⇔hand swap net 不変 / §5 ★chain break★ B06029 a1 を 0 証拠で駆動 → step2 skip
  (「そうした場合」semantics の 1対1 witness) / §6 出荷2カード構造突合。
- **敵対verify (opus、refute lens)**: **OVERALL SHIP / refute 0**。chain break を **3 経路** (no-candidate /
  human-decline candidate在 `useEngineDispatch` chain-origin drop / AI `apply-pick`) で engine path 追跡し
  「step1 が card 移動した時のみ step2 発火」を確証。faceUp/top配置/在庫ガード/ヒラメキ短縮形/DEFER 妥当性 全 ship。
- **DEFER**: B03077 (証拠「上から」= evidence-top→hand、`evidenceToHand` fromTop 別変更) / B06033 (ヒラメキ
  evidence-self→hand verb 不在) / B06016 (別【登場時】= deck-mill-gated chain)。各々別 engine 変更ゆえ「混ぜない」で除外。

## 学び (恒久)

- engine拡張 micro-cluster の **clean yield は handoff 見積りより小さい場合がある**: handToEvidence は「2 verb / ~3 base」
  見積りだったが、深い grounding で「**1 verb / 1 base**」と確定 (evidence→hand 既存 + 残3カードは各々別 gate)。
  着手前の決定論 scan に加え、**実テキスト全句 grounding で「真の clean yield」を確定**してから scope を絞る。
- **decoy test が実 engine バグを捕捉**: §3 (target 不在) で「手札に無い cardId でも証拠が湧く」初版バグを検出・修正。
  非MVP カードは decoy unit test が唯一の engine 駆動証跡 — 境界 case (不在/0枚/重複) を必ず含める。
