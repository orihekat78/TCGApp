# memory — 現セッション scratchpad

## セッション㊾ (2026-06-23) — wave leave-from-remove (engine変更0、10枚出荷)

方向: ユーザー A2「engine投資」選択 → leave-trigger クラスタ (棚卸57) を grounding 精査。

**重要訂正 (grounding)**: 棚卸の「leave-trigger=【現場リムーブ時】hook 一般化が最難」は **誤**。
hook (leave:to-remove) は 30枚超 subscribe の成熟済 path。機械分類で 57 を 8 群に分解
(A:contact-self 3 / B:self-leave→from-remove 11 / C:reveal-until 3 / D:ally-observer 7 /
E:opp-observer 2 / F:self-revive 5 / G:keyword-filter別物 5 / X:誤タグ15 / Z:他6)。
最大 clean slice **group B** は B03113 シェリー verbatim exemplar で **engine変更ゼロ**
(sceneEnter{from:remove} は atom-pick-spec.ts:60 既存、20枚超先例)。ユーザー確認 → group B 出荷。

**出荷 10** (ALL_CARDS 1395→1405、各 touched 1): B02075/P 諸伏高明 / B02066/P メアリー (a1 登場時draw+discard) /
B05091/P 風見裕也 (a1 絆降谷零 突撃[キャラ] continuous + a3 ヒラメキsleep) / B05099/P 高木渉 (and[partnerColor黄,turn opp]) /
B05058 富沢 (a2 handAddFromRemove, a1 DEFER) / B05116 火傷の男 (a2 sceneEnter色黒, a1 DEFER)。

**DEFER 3** (grounding で engine gap 発見、DEFERRED-INDEX §leave-from-remove):
- B05111 全体: a2「ヒラメキ→アクション中のキャラ」= hirameki ctx に actor binding 不在 (汎用pick=over-fire不誠実)
- B05058 a1: 「現場にいるこのキャラは特徴[X]を持つ」= trait付与機構ゼロ (readTraits 静的のみ/charGrantTrait無)
- B05116 a1: 「相手はイベント効果で必ず選ぶ」= forced-target 強制選択機構ゼロ
- B05058/B05116 は **partial-ship** (a1 DEFER + a2 出荷) = 先例 ct-p04/B04059 同型

**プロセス**: opus grounding workflow (6 unique→DSL blueprint + 敵対verify、独立判定と一致) →
手書き10枚 (B03113/B02038/B03089/B08010/D01012/B03067 exemplar) → decoy test 13件 →
敵対 faithfulness review workflow (opus 6 lens + engine-0 lens)。

**検証**: tsc0両 / vitest 2868→2881(+13) / smoke winsA=498 exc0 baselineOK / e2e / pre-commit。
validate-specs FAIL PR280 は既存・無関係 (CI gate でない)。engine diff 0 = engine変更0 確証。

水平展開: 残 leave-trigger 群 (D/E/F/A 観測者型 = 真の engine 投資先、cause/actor binding 拡張で次弾)。
