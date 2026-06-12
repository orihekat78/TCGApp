## Task A batch#2 — 多エージェント certify workflow 確立 + harvest #1 + wave3 (opt-cost) 8枚

**Round/Phase**: 2026-06-11 session — green候補 266 の一括 certify を多エージェント workflow 化し、検証済 green を収穫。

### certify workflow (engine変更0 候補の grounded 判定基盤)
- `scripts/wf-certify.mjs` — 各カードを **certify → adversarial verify** の 2 段で処理:
  - certify agent: 全句を capability-map.txt + 実 engine code + exemplar で grounding → verdict(green/yellow) +
    AbilityDef JSON + tier + clauseMap。⛔ gate / closure 必須は yellow / needsManual。
  - verify agent (green のみ): 句マッピングを敵対的に refute (filter/hook/条件/枚数/optional の逸脱を fatal 判定)。
  - サーバ request-rate throttle 回避のため **SUB=8 サブバッチ直列** で実効並列度を制限。
- `scripts/taskA-{codegen,register,validate-specs,build-queue,next-chunk,collect-greens}.cjs` — spec→CardDef .ts 生成
  (TSV から stats 補完、`__eventUse` closure / `__shared` 共通クラス / `needsManual` 対応)、_reuse 登録、
  決定的 spec 検証 (verb/hook/condition/cost/filter whitelist + closure 禁止)、queue 分割、green 集約 + clone 展開。

### harvest #1 (30 reps certify 済 → verified green 5 + 敵対 refute 1)
- 実装 (engine変更0): **B01050** (enterSleep+look-1【白】→hand+ヒラメキdraw) / **B01069** (【登場時】optional 相手証拠+1→draw) /
  **B02053** (event __eventUse → リムーブ【白】[怪盗]Lv7登場 + ヒラメキ handAddFromRemove) /
  **B02083** (event【パートナー黄】→ forEach 相手スタン数 draw + conditional stun-pick)。
- 敵対 verify が **B02026 を refute** (triggerCharMatches{side:opp} の no-filter が相手パートナーのアクションに誤発火 →
  filter:{kind:'character'} 必須) — 誤 green を codegen 前に阻止。**B02073 は cost 解釈 (sleep+self-remove) 疑義で
  e2e 確認まで DEFER** (adversarial verify は pass だが精度優先)。

### wave3 (opt-cost reanimate, 手動 grounding 4枚)
- **D05006 / B06052(+cutin) / PR138(+ヒラメキ sleep-pick) / PR144** — 「(自スリープ,)手札1リムーブしてもよい。
  そうした場合、リムーブから〚X〛を(スリープ)登場」= `optional{ chain[ (sceneSetState$self sleep,) discard1,
  sceneEnter from:remove ] }` (B05019 optional + D08003 chain + D01012 enterSleep 同型)。

### harvest #2 (chunkB 59 reps certify → verified green 16 → 15 実装 / B02073 DEFER)
- chunkB(B03014..B05115) を SUB=8 で完走 (usage cap 未到達)。verified green 16・refuted 0・yellow 43。
- 実装 15枚 (全 tier2、settled パターン再録): B03014(phase:end:start) / B03018(leave look-5 event+ヒラメキsleep) /
  B03069(continuous LP + leave optional + ヒラメキ handAddFromRemove) / B03081(event 相手キャラ手札+discard) /
  B03101(enter sleep-pick + draw) / B03120(enterSleep+宣言 self-remove+ヒラメキ) / B04023 / B04049 / B04082(action:declare mc→handAddFromRemove) /
  B05017(look-until 青event) / B05073(misreadX+宣言) / B05074(宣言×2) / B05090(手札からenterSleep+条件draw+cutin) /
  B05094(leave look-until + draw) / B05098(宣言 selfToDeckBottom→handAddFromRemove)。
- codegen 修正: character の ap/lp が TSV 空欄のデータ欠落を **0 default** (B03120 lp 空 → lp:0)。
  collect-greens に **DEFER リスト** (.tmp/taskA/defer.json) を追加し B02073 を恒久除外。

### 検証 (全グリーン / 回帰0)
- 新規 `tests/cards/certify-harvest-wave3-batch.test.ts` (6) — optional 決定 (applyOptionalAndContinuation) +
  opt-cost chain の discard→reanimate pick 連鎖 + event reanimate + forEach 実 flow。harvest #2 15枚は
  adversarial verify (句単位 grounding) + reuse-batch 構造検証 + smoke + e2e でゲート (catalog-reuse 同流儀)。
- full vitest **1899 pass / 1 skip / 0 fail**、typecheck・eslint clean、smoke:1000 **exceptions=0**、e2e **115 pass / 0 fail**。
- ALL_CARDS **1084** (本 session: harvest#1+wave3 8 + harvest#2 15 + harvest#3 3 = 65枚 (harvest#5 +23)。**254/254 certify 完了** (green 70 auto + 5 needsManual / yellow 176)。
- tier2 選択カードの text-faithfulness Playwright spot-check は follow-up (catalog-reuse 同様、batch ゲートで一次担保)。
