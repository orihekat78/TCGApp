# Row 024 — expert-method UI microtest (attempt 4)

## Scope

- Worklist row 024。desktop、P1。
- 完了済みhistorical rowの置換、row status更新、row 026開始許可ではない。
- visible UI/log、自分の正規手札、公開catalog、公式rulesだけを使用。
- state、dispatch、pending、相手hidden、裏向き識別は不使用。

## Public observations and decisions

| Point | 観測 | 代替 | 実行/監査 | 結果 |
|---|---|---|---|---|
| Mulligan | 初手5枚に低levelキャラ2枚。partnerは初手と別に公開表示。 | redraw / keep | keep。序盤bodyを確保。redraw内容は未知。 | match開始。 |
| P1 T1 | FILE1、YOU 0/7、CPU 0/6、partner active。手札はlevel不足。 | partner推理 / Next Hint / end | partner推理。確定+1証拠。Next Hintは最上部カードを手札へ加え直後の任意使用を得る一方、同ターンの通常手札使用を不可にする。 | YOU 1/7、partner sleep。 |
| CPU T1 | CPU 1/6、FILE2、partner sleep、公開remove logあり。 | observe | 相手hiddenを推測せず再観測。 | YOU T2、FILE3、partner active。 |
| P1 T2 hand | B01033遠山和葉Lv2とB09030服部平次Lv2は共にAP1000/LP1。和葉は手札cut-in AP+2000、平次は自ターンcut-in AP+3000。 | hold / 平次を使用 / 和葉を使用 | **実行は和葉**。事後監査では、カード名・特徴などの印字情報に依存する公開効果がない当該局面で手札使用を行うなら平次使用＋和葉温存を和葉使用より優先。場のstats差がなく、和葉を手札から失いCPUターンcut-in optionを消した。holdとの優劣は次ターンclock不足で未確定。 | 和葉がsceneへ。手札使用枠消費。 |
| P1 T2 reasoning | YOU 1/7、CPU 1/6、partner active、和葉は名乗り中。 | partner推理 / end | partner推理。activeなpartnerをsleepし確定+1。 | YOU 2/7、partner sleep。 |

## Finding

- P1 T2はrule/card-zone理解の失敗。`09-cutin-disguise.md`ではcut-inは手札から使用し、
  解決後remove。sceneの和葉は次CPUターンを守らない。
- このmicrotestは判断loopの操作可能性だけを示す。熟練判断methodの妥当性は確認しない。
- 公開catalogは自分の正規手札で見えていたB01033/B09030の本文確認にだけ使用。
- opponent FILEは裏向きのまま。identityを読まず、推測もしなかった。

## Stop

P1 T2後に停止。resultなし。row 026 gate、55-pair gateは未達。
