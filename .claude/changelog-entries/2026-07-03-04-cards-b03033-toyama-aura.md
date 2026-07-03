### card-authoring vein — B03033/B03033P 遠山和葉 (apDeltaAuraOpp 初 consumer, engine変更0)

CARD PHASE 初弾。DEFERRED-INDEX の dormant exemplar (engine 名指し・未登録) を第2gate 検査して解禁。

- **B03033 / B03033P 遠山和葉** (ct-p03, character, 緑 Lv4 AP4000 LP1 高校生):
  - a1【自分ターン中】相手の現場のカードがセット済キャラを AP-1000 = `continuousModifier{apDeltaAuraOpp:-1000, auraFilterOpp:{hasSetCards:true, kind:'character'}}` + `condition{turn:self}`。
    cross-side 数値 aura (engine additive 2026-06-29 出荷済) の**初 live consumer**。D07010 の自 side apDeltaAura を Opp 版に。
    公式 QA (「選ばれない能力持ちも対象」「枚数不問で -1000、bearer 複数で重複」) が select 不介在=aura を裏づけ。
  - a2【ヒラメキ】draw1 = D07010 a2 完全同型 (evidence:remove-by-action optional)。
- tier = **T1** (D07010 clone + engine primitive は wave-0629b で 4-review 済 + passive aura で UI 相互作用なし)。
- 検証: tsc0 / vitest 3772→3775 (+3 probe `b03033-toyama-aura.test.ts`: aura -1000 / 自分ターン gate / bearer2枚 stack) /
  smoke winsA=498 exceptions=0 (baseline 不変、engine変更0) / playwright N/A (passive aura, 未 deck-playable)。
