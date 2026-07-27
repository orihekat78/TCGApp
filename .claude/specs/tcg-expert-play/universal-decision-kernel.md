# 汎用TCG判断kernel

状態: 説明可能なbaseline。プロ同等の勝率・最適性は **UNPROVEN**。
Claim IDは [source register](../../research/tcg-expert-play/source-register.md) に対応する。

## 0. 情報境界を固定

- `shared-public`: 双方に公開された盤面、履歴、公開カード。
- `player-visible`: 自分だけが正当に見られる手札など。自分の判断には使用可。
- `hidden-range`: 相手手札や山札順の可能性。事実として扱わない。[K4]
- `forbidden-internal`: state、pending、dispatch、裏向き識別。使用禁止。
- open/closed decklist、先後、制限時間、ルール版を宣言する。

## 1. 時計

1. この行動列で今勝てるか。
2. 相手が次の行動列で勝つ、又は不可逆な優位を得るか。
3. それを止める最小支出と、自分の代替時計を比べる。[K1]

## 2. 合法候補

1. 公式ルールとカード本文から `ruleCandidates` を作る。
2. 公開UIの `uiCandidates` と別に照合する。
3. 勝利、防御、盤面、resource/hand、情報、passから目的の異なる候補を2つ以上残す。
4. 集合不一致、版不一致、根拠欠落なら操作せず `blocked`。

## 3. 比較

各候補の実行後を `clock / board / resource / hand / information /
next-turn risk / option` で比べる。[K2][K3]

- 数値を無理に合算しない。即勝敗を最優先する。
- 対象、任意効果、反応、passも独立候補にする。
- hidden-rangeを使う場合は範囲、根拠、外れた場合の損失を書く。
- 最大値、先頭候補、resource使い切りをtie-breakにしない。

## 4. 実行と再観測

- 実行前: `観測 → A/B → 選択 → 期待差 → 反証条件`。
- 解決後: 状態とログを再観測し、予測差だけを記録する。
- 結果を知った後で当初理由を書き換えない。[K6]
- 対局後仮説は次のpacketでreviewされるまで対局中根拠にしない。[K5]
