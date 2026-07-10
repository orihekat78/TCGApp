## 夜間自走 Wave 0 — cost-choice UI + multi-pick UI + stale-DEFER GREEN 6 (+13 printings、1903→1916)

- **cost kind:'choice' human 選択 UI** (B09027 大岡紅葉 +P 初 consumer): flows.ts 3.6 に
  ChoicePicker branch 選択を追加 (canPay で payable 絞り、1 択 auto / 0 択防御)。
  costChoice → ctx.dyn 配線は既存 (ability-activate.ts) — 欠けていた human picker 1 段のみ追加。
- **EffectPickerModal multi-select mode** (B08019 大岡紅葉＆伊織無我 +P 初 consumer):
  nMax>1 で toggle 選択 + perSideMax quota (「自分と相手で1枚ずつ」) + nMin の実選択可能数 clamp
  (soft-lock 防止) + 確定 button。e2e night-w0-cost-choice-multipick.spec.ts 2 本で実機検証。
- **removeSetCard cost `anyFace` param** (B05052 工藤優作): 「セットされているカード」(裏向き限定
  句なし) を表裏不問で計数/除去。default 従来挙動 (裏向きのみ)。
- **stale-DEFER GREEN 6**: B07099 板倉卓 / B01020 毛利小五郎 / B03111 バーボン(+P) /
  B01077 赤井…秀一!? / B07102 犯人 / B05117 コンコン(+P) — 全て既存 primitive の clone、engine 変更 0。
- **BUG-186 修正**: sceneEnter 短縮形が pick side に絶対値を渡し owner='opp' で反転 (候補 0)。
  相対値渡しに修正 (BUG-174 同族)。水平展開で hand 系 atom ~10 site の同族 latent を BUG-187 起票。
- 原則 DEFER 3 (推測実装回避): B09081 (hirameki optional collapse) / B09052 (cutin declareName
  dyn 不達) / B09110 (deckRevealUntil early-stop 不在 + PA self-remove 不達)。
- gates: tsc 0 / vitest 5187 (+74) / smoke winsA=472 exceptions=0 / 8 lint err0 / crosscheck 14/14 /
  e2e 新規 2 pass。
