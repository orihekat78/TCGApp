# CARD PHASE dormant 棚卸し (2026-07-03)

DEFERRED-INDEX の未登録 135枚を engine-unlocked / blocked に triage。出荷済 = B03033(3ed71dcc) / B06006(63000bc6)。

## UNLOCKED = engine変更0 で今 author 可 (15枚 / 10クラスタ)

| # | クラスタ (パターン) | カードID (枚) | 主 primitive (出荷済) | exemplar | risk |
|---|---|---|---|---|---|
| 1 | cutin:used observer (第三者 contact-cutin) | B09086, B04090 (2) | `cutin:used`+`triggerCutinMatches` | **B03118 キール** | 中 |
| 2 | misread:performed observer | B05015, B09016 (2) | `misread:performed` hook | なし (first) | 低〜中 |
| 3 | 継続 grantTraits/grantNames | B05012, B07053 (2) | `grantTraits`/`grantNames` P37 | wave-6 (first card) | 低/中 |
| 4 | case継続 手札使用制限 | B05120, B06109 (2) | `handUseRestrictFilter` P05 | wave5 (first card) | 中 (UI+playwright要) |
| 5 | bound集合 any-match cond (G17) | PR132, D06013 (2) | `boundAnyMatchesFilter` | wave5 (first card) | 中 |
| 6 | 印字keyword turn付与/剥奪 | B06068 (1) | `revokedKeywords`+`charRevokeKeyword` scope:turn | caller 0 (first) | 中〜高 |
| 7 | setcard:enter + face-down set | B02018 (1) | `setcard:enter`+`charSetCard fromDeckTop` | B06046(2次gate有) | 中 |
| 8 | remove総数 condition | B03104 (1) | `removeCountAtLeast` | D11019 | 中 ⚠off-by-one既知 |
| 9 | ランダム discard | B01077 (1) | `discardRandom`+grantKeywords | なし (first) | 中 |
| 10 | enter-count condition | B09089 (1) | `enterCountAtMost` | removeCountAtLeast同型 | 高 ⚠TSV空=再fetch |

### batchable = 同一パターンのペア (クラスタ 1〜5)
5ペア=10枚。各クラスタで engine token 検証を1回共有 + smoke/lint 末尾集約。**但し大半 first-consumer (exemplar 無) → 各カード grounding + human-path playwright probe 必須** ([[reference-carrier-reuse-human-path-empirical]])。「clone」ほど楽ではない。

### 単発 (クラスタ 6〜10) = 1枚ずつ、要注意
B09089/B03104/B01077 は local TSV effect 列**空** (encoding欠損) → 公式text 再fetch 必須。B06068 は contact-remove trigger+絆+turn1+keyword swap で risk 中〜高。

## near-unlocked (要 verify、engine変更0 の可能性、follow-up probe 候補)
B06026 (leave:to-remove self-trigger 配線済見込み・未実証) / B02062 (evidence:removed 発火順 実機確認) / B05087・B05088 (remove:exit がコスト由来離脱を拾うか公式Q&A確定要) / B06043・B06065 (evidence-flip、cost出荷済・deck-look grounding未)。

## BLOCKED 120枚 = engine 拡張待ち (missing primitive 別、代表)
removed-by-effect bind(8) / untargetable-grant(5) / MR·PA構造(6) / 事件解決override·alt-win(6) / set-card WRITE系(7) / 未出荷 observer hook(8) / variable-count pick(5) / evidence revive(4) / hirameki cascade(5) / deck-look variant(5) / name指定 UI(4) / keyword-presence filter+疾風(4) / levelDelta 2次gate(4) / opp-ability-deny(4) / self-remove drain(3) / play-event-from-effect(2) / colorNot dyn·contact-cond(3) / 単発bespoke(~37)。

## 推奨実行順 (安全→リスク)
1. **クラスタ2 misread ペア** (B05015 低risk + B09016) — first-consumer だが hook 明快
2. **クラスタ3 grantTraits ペア** (B05012 純grant 低 + B07053)
3. **クラスタ1 cutin:used ペア** (B03118 exemplar 有 = 真clone に近い)
4. クラスタ5 G17 / クラスタ4 handUseRestrict (UI/playwright 重)
5. 単発 (B06068 → B02018 → 残、要 text 再fetch)
