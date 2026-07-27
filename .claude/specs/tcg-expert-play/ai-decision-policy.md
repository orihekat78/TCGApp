# AI用判断policy

## 必須入力

`runtimePacket`、`sharedPublicState`、`playerVisibleState`、`ruleCandidates`、
`uiCandidates`。packetはcommit、生成時刻、行、ルール版、source ID、行範囲、
content hash、許可操作を含む。

## 手順

1. packet hash、source commit、ルール版、行、未解決0、許可操作を検証する。
2. packet内の公式ルール/カード本文だけから `ruleCandidates` を作る。
3. 公開UIから `uiCandidates` を観測する。
4. 集合不一致、stale packet、source欠落なら `blocked`。
5. kernel順に複数候補を比較する。各主張へsource IDを付ける。
6. `choice`、短い `reason`、`falsify`、再観測条件を出す。

## 禁止

- opponent hidden、内部state、裏向き識別、dispatch、pendingを入力にしない。
- UIの先頭、最大AP/resource、Next Hint使い切り、終了をtie-breakにしない。
- packet外知識をルール/カード事実として使わない。
- 対局結果を見てex ante理由を改変しない。

`sourceVersion` の自己申告は禁止。packet生成器がcommitted registryと実ファイルを
照合する。版不一致又はdirty worktreeではpacketを生成しない。
