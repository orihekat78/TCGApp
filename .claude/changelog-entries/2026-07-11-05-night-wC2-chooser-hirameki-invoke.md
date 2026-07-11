## 夜間自走 WC2 — chooser:'opp-of-owner' + invokeHiramekiOfCard (+4 printings、1953→1957)

- **pick chooser 反転 chokepoint** (B05093+P 初 consumer): substituteAtomPick で
  `chooser:'opp-of-owner'` のみ byPlayer を owner 相手側へ反転 (plain 'opp' は短縮形の絶対 chooser と
  二重反転するため専用マーカー)。下流は既存 infra (pending.player / drainAiEffectPicks / BUG-175
  ownerPlayer) がそのまま機能。atomHandAddFromDeck に '$pick.cardId' await 分岐追加。
- **invokeHiramekiOfCard verb** (B06023 / B06034): 他カードの【ヒラメキ】効果を emit 非経由で直接
  queue (invokeLeaveToRemoveOfCard 直系)。$cost.flipFaceUpEvidence.ids channel + resolveBindRef
  $cost 対応 + optional-resume costPaid 復元 (production unbound 化の根因修正)。
- **T2 混成 review BLOCK 1 → 修正**: B06034 が flip と invoke を 1 optional に束ね「表向きにしたが
  発動しない」不能 (rules/15)。sequence[flip bind, conditional{boundMatchesFilter YAIBA+ヒラメキ,
  then invoke optional:true}] に再構成 — walk-level optional は unstable-if pre-walk で eager surface
  する実測により **atom-level optional** (bind 確定後にのみ surface) を採用。
- DEFER: B02086 (optional/choice の chooser=opp + else 枝 = opp-decision infra 別 wave) /
  B06036+P (cost-flipped-ids を候補プールとする pick source — verb/channel は本 wave で解禁済)。
- gates: tsc 0 / vitest 5370 / smoke 472 exc0 / lint err0 / probe 21。**1957 / 2074 = 残 117**。
