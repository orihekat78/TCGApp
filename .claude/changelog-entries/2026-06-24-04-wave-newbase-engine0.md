# cards — wave newbase (4枚、engine変更0)

**Round/Phase**: 2026-06-24 カード追加 wave (engine変更0)。真に未実装の新規 ability カードを
per-card full-text grounding → 二段敵対verify (codegen前) で出荷。

> 並行 session 56 と独立に作業し、**B06100/B06100P ベルモット** と **白馬探 DEFER** は
> 両 session が convergent に同一結論 (同一 chain spec / 同一 engine gap) に到達。重複を避け、
> B06100/B06100P は session 56 出荷分 (e0ef2803) に委譲し、本 wave は残り **新規 4 枚**に絞った。
> 白馬探 DEFER も session 56 が DEFERRED-INDEX に記録済 (重複追記せず)。

## 出荷 (ALL_CARDS +4、engine変更0)

- **B06079 アンドレ・キャメル** (赤 lv5 FBI): 【登場時】自分の能力/効果で登場した場合のみ、ターン終了時まで
  AP+1000 + 〚突撃〛付与 = enter + `condition enterSource{viaEffect:true}` → `seq[charModifyAP $self +1000 scope:turn,
  charGrantKeyword $self 突撃 scope:turn]`。exemplar B06007 / B01014。
- **B03124 テキーラ** (黒 lv6 黒ずくめ): a1【パートナー黒】〚突撃〛= `partnerColorKeyword({color:'黒', kw:'突撃'})`。
  a2 自ターン終了時 self が sleep/stun なら自身を remove = `triggered phase:end:start + and[turn self,
  or[charStateIs self sleep, charStateIs self stun]] → sceneRemove $self`。a2 は partnerColor 非依存 (公式qAndA)。
  exemplar D03003 / B07021。
- **B03068 / PR094 赤井秀一** (赤 lv6 FBI|赤井家): 【登場時】手札から〚赤 Lv≤4 キャラ〛1枚 sleep 登場してもよい。
  しなかった場合 相手に証拠1 + 1ドロー (必須) = `seq[sceneEnter{from:hand, enterSleep:true,
  filter:{color:'赤', levelMax:4, kind:'character'}, n{0,1}, bind:$matched}, conditional{if:not(bound $matched),
  then:[evidenceGain{opp,1}, draw{self,1}]}]`。decline→$matched 未 bind→else 発火。exemplar D09020 / D05007。

## 検証 (engine変更0 ゲート、新 main 3538e052 基盤で再実行)

- `taskA-validate-specs` pass 4/4 (frozen-engine whitelist 機械保証)。touched: src/cards のみ (engine 0)。
- **二段敵対 verify** (opus high、codegen 前): certify→verify。各 agent が clauseMap 引用 exemplar と
  engine handler (atom-handlers/cond/eval) を **実読**し verb arg 名 (kw/enterSleep/charStateIs state:'stun'/
  sceneRemove cause)・量指定子・filter・semantics vs qAndA を句単位反証 → 全 ship exact coverage。
- `tsc` 0 / `vitest` (+9 decoy、本 wave) / `smoke:1000` winsA=498 exceptions=0 baseline OK (engine変更0 証跡) /
  eslint・lint 群 0err。
- decoy test: enterSource gate 実評価 (viaEffect true→fire / false→skip) / charStateIs+turn gate 実評価
  (sleep・stun@自ターン→remove / active・相手ターン→skip) / 4枚構造忠実性 + PR094=B03068 一致 (BUG-117/118 教訓)。

## 棚卸メモ (process)

- `_registered-ids` 生成の正規表現 `^\s*id:` が spread variant (`{...BASE, id:'XX'}` inline id) を取りこぼし、
  catalog-reuse 済を「未実装」誤判定していた。`export const <ID>: CardDef` 走査へ修正 (session 56 の
  orphan-registration-fix とも整合)。inventory-remaining の registered-set はこの方式で再生成すること。
