## 夜間自走 Wave A — engine additive 15 rep 相当 + exemplar 19 printings (1916→1935)

- **verb/zone (A1)**: charGrantTrait/RevokeTrait (permanent/turn、read+matchOneFilter 二重 honor、変装引継ぎ) /
  charStackCard fromScene (現場キャラを host 下へ、D10009/D10010) / handAddFromRemove area 配列 union splice
  (remove∪partner-area、B07049) 。
- **hook (A2、6/6)**: charGrantAbility leave:to-remove 解禁 + granted 走査 (B07063) / action:guarded payload
  targetUid (B04073) / state:change hook 新設 (active→sleep 実遷移のみ emit、B03008) / peekOwnEvidence verb
  (B03040) / on-set-self scope + setcard:leave self 走査 (faceUp gate、B02084) / forceGuard token (攻撃側起点
  ガード義務、UI/AI 共通 chokepoint、B03041)。
- **cond/dyn/cost (A3)**: removeDeckAll cost (B09107) / colorIgnoreOnNextHint token (NH 限定色無視、B02087) /
  setActionCutinBanFilter (filter 付き action-scope cutin ban、B05007) / $removed snapshot dyn (実効値、
  B08002 primitive) / charRemoveSetCard・sceneRemove に bind arg。
- **刈り取り**: B05007 (optional{sequence}、公式Q&A 登場0でも draw) / B05097 (count-picker 代替 =
  choice{mill 0..5}、choiceOptionLabel mill 対応) / P spread 6 (B07063P B02084P B03041P B09107P B02087P B05007P)。
- **T2 混成 review (sonnet5+opus) BLOCK 1 → 同 wave 修正**: removeDeckAll がコスト時 refresh を発火せず
  (公式Q&A「コストを支払った時点でリフレッシュ」違反、wrong-winner 構成可)。pay に即時 refresh +
  remove 0 時の deck-out 敗北を実装、probe の誤 pin を是正。
- DEFER (原則、推測実装回避): B05101 card ($self.cardId 復活 idiom 不在) / B06005 (count-choice UI) /
  B09078 (dual-filter window pick) / B09039 (handAddFromRemove 0-add gate) / B08002 card (dual-pick) /
  B08078 (外部 hook 発火機構)。
- gates: tsc 0 / vitest 5272+ / smoke 472 exc0 / probe 90+ green / sync-taskA green。**1935 / 2074 = 残 139**。
