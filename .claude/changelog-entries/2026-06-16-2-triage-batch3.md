## トリアージ・スイープ 出荷バッチ#3 — window4 残8 certify → verified green B03079 + clone = 2枚 (engine変更0、ALL_CARDS 1275→1277)

window4 (=window2-ids.json 32 rep) の残 8 rep を per-card certify (opus grounding→敵対 verify) し、
window4 を **完全消化**。verified-green は **B03079 のみ** で、byte同一 clone B03079P と合わせ **2枚** 出荷。

- **出荷カード**:
  - B03079 レイチェル・浅香 (+B03079P): 【相手ターン中】【現場リムーブ時】デッキ上3枚を見て【赤】カードを1枚まで手札へ
    (残りデッキ下) +【ヒラメキ】キャラを1枚まで選びスリープ。a1 は D05007/D01013/B01013 の certified-green 句を
    hybrid 再構成 (leave:to-remove×turn:opp×color deck-look×chooseMatch:upTo)、a2 は D05007 a2 と byte同一。
- **パイプライン** (バッチ#1/#2 と同一): certify spec → `verify-clone-identity.cjs` (clone byte同一性、divergent 0) →
  `build-verified-codegen-input.cjs` (ADOPT 1 + clone 1) → `taskA-codegen.cjs --write` → `taskA-register.cjs`。
- **certify 結果 (window4 残8)**: green 2 (B03056/B03079) / 敵対 verify 通過 1 (B03079) / yellow 6。
  window4 累計: 32 certified / green 6 / **verified-green 5** (batch#2 4 + batch#3 1) / refuted 1 / yellow 26。
- **出荷除外 (DEFERRED-INDEX へ記録)**:
  - **B03056** REFUTED: a2 が `conditional{if: sceneHas(探偵 sleep nMin:3), then: optional{...}}` 構造で、engine の
    resolveEffectPicks walk が conditional.if 評価**前**に optional を human へ eager surface し resume 時に conditional
    ラッパを落とす → 3枚未満でも証拠獲得+自己リムーブが発火 (敵対 verifier が evidence 0→1, self removed を実証)。
    **新規 gate: conditional-gated-optional surfacing**。
  - yellow 6: B08033 (set-card-removal COST kind 不在) / B05027 (MR partner-area structure) / B01057・B02031
    (set-card→host 能力付与) / PR263 (partner-area ビッグジュエル列挙) / PR099 (name-designation + card名書換 verb 不在)。
    いずれも既知 STILL-OPEN gate。
- **gate5 実機挙動検証** (新規 `tests/cards/triage-greens-2026-06-16/B03079.test.ts` / **7 tests**): a1 を実 engine flow
  (`mutate.scene.removeToRemove` 相手ターン中) で発火させ、color:'赤' filter の **実評価** を decoy (上3枚先頭の青イベント・
  青キャラ) で 1対1 検証 (filter 無視なら先頭 decoy が拾われる構図で、赤のみ採用＝honor 実証)。condition turn:opp は
  自分ターン負ケースで、0-match 負ケースも検証。a2 は `evidence:remove-by-action` を実発火し pendingHirameki surface
  (cardId/abilityId/player) + 負ケース、carrier 形は shipped byte-identical exemplar D05007 a2 との完全一致で担保
  (carrier runtime は同一 sceneSetState pick を駆動する B02019 gate5 で human+AI 実証済)。BUG-117/118 リスクを per-card に閉じた。

検証: validate-specs 32/32 pass (engine変更0) / tsc clean / **vitest 2438 pass (+7) 0 fail** /
smoke:1000 baseline 不変 (winsA=498, avg=11.0, 0 exception) / playwright 回帰 119 pass (1 skip) / 規約 lint errors=0。
