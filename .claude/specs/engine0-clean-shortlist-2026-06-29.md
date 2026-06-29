# ENGINE0 clean-shortlist (決定論 pre-filter, 2026-06-29)

「全数掘る」wave の backbone。211 ENGINE0 候補 ([engine0-vs-extension-2026-06-29.tsv](engine0-vs-extension-2026-06-29.tsv))
を **決定論 gap-marker classifier** で絞り込み、真の clean engine変更0 を per-card certify する。

## 背景 (なぜ filter が要るか)

分類器の「211 ENGINE0」は **楽観値**。5 cluster をサンプルした実測で、残カードの大半は engine 拡張を要する
複雑裾だった (簡単な純パターンは過去 wave で出荷済)。盲目 certify は 211×~200k=42M tok で非現実的 →
gap-marker で機械的に絞る ([[feedback-token-economy]] 決定論優先 / [[feedback-engine-cluster-over-green-tail]])。

## classifier

- script: `scratchpad/clean-classifier.cjs` (gap-marker regex 16種 + registered.txt 除外)。
- gap-marker = base-override / deck-look / ability-presence / var-count / 捜査 / 痕跡 / self-remove-all /
  choice-multi / MR / mainphase-start / mass-remove / evidence-peek / cutin-reaction / until-reveal / turn-loop / set-card-rider。
- 出力: 0-marker = **133 候補** (high-confidence clean、ただし false-positive 残る ← marker は完全でない)。
  各候補は **certify 必須** (0-marker でも複雑カードが混入: B08092P=ability-presence「を持つレベル4以下のキャラ」を
  regex が取りこぼした例)。

## 出荷済 (本 wave)

- ✅ **B09061** ジェイムズ・ブラック (handReveal exact-N + handAddFromRemove ヒラメキ、main)。
- ✅ **B03066/P** 赤井秀一 (partnerColorKeyword + optional[evidenceGain opp, sceneRemove lv7])。

## triage 済 (本文読了) — clean / gap 判定

| ID | 判定 | 理由 |
|---|---|---|
| B02049/PR039 中森青子 | 要 certify | ally-action trigger → **そのキャラ(actioning ally)** を AP+1000。trigger-actor binding の有無が gate |
| B01035/D06009 大滝悟郎 | 要 certify | 【現場リムーブ時】**cause:contact** filter + hira draw。cause filter の有無が gate |
| B04092/B04093 キャンティ/コルン | 要 certify | contact-trigger + self-sleep optional + AP buff。B03039 系か |
| B03093 西村京兵 / B03030 伊織無我 | DEFER | untargetable (相手効果で選ばれない) = C04 engine gap |
| B01045/B05022 | DEFER | base-override (元AP/LP 0化) |
| B06028/B03085 | DEFER | hira「アクション中のキャラ」= engine 不在 |
| B08043 | DEFER保留 | 相対 LP threshold filter (AP は G15 出荷、LP 軸 latent) |
| B04042 | DEFER | レベル合計≤constraint multi-pick |
| B08092P | DEFER | ability-presence「【現場リムーブ時】を持つキャラ」(marker 取りこぼし) |

## 次手順

1. 上表「要 certify」(B02049/B01035/B04092 系) の trigger-actor binding / cause:contact filter を engine 実測 → clean なら出荷。
2. 残 133 の未読 (~90枚) を `node .tmp/_fulltext.cjs <id>` で本文確認しつつ certify (SUB=8 直列)。
3. 出荷ごとに本表更新 + registered.txt 再生成。
