# 共通パターン集計 (cards/_shared 候補)

47枚分析から抽出。**3枚以上で出現したパターンを共通クラス化**。
2枚は監視対象 (将来 3枚目で昇格)。1枚は個別実装。

## 確定共通クラス (cards/_shared/) 候補 — 6件

| クラス候補 | 出現枚数 | 出現カード | パラメータ | 説明 |
|-----------|--------|-----------|----------|------|
| **partnerCommon** | 4 | D08001/02, D11001/02 | なし | 全パートナー共通 (アシスト+事件解決) → **骨格内蔵** で OK (既存 spec) |
| **partnerColorKeyword** | 5 | D08009/10, D08022, D11011, D11007/08 | { color, keyword, scope?, additionalCondition? } | 【パートナー色】 → 単純キーワード付与 |
| **cutinFixedAP** | 7 | D08015/16, D08017/18, D08023, D11013, D11017, D11018 | { delta, scope='contact' } | 【カットイン】固定 AP+ |
| **hiramekiCharStun** | 4 | D08019/20, D11009/10 | なし (対象1枚まで) | ヒラメキで対象キャラ1枚スリープ |
| **hiramekiDraw** | 4 | D08013/14, D08024 | { n=1 } | ヒラメキで N 枚ドロー |
| **caseTraitConditioned** | 4 | D11003/04, D11005/06 | { trait, conditionInner } | 【事件特徴】条件で内部能力解放 |

※ partnerColorKeyword は D11007/08 の「【パートナー黄】突撃」も該当 (5+2=7枚相当だが 2枚はカード固有複合能力の中なので最小5)

## 監視対象 (2枚出現・将来昇格) — 19件

| パターン | 枚数 | カード | 共通化見送り理由 / 待機条件 |
|---------|-----|-------|------------------------|
| caseResolvedHandRemove | 2 | D08026, D11021 | 事件カード共通 → 確定クラスに昇格 (実質確定) |
| caseDeclaredEvidenceFlip | 2 | D08026, D11021 | 同上、パラ化 (delta/target/cond) |
| continuousAPperEvidence | 2 | D08005/06 | 単一実印刷 |
| declaredFlipForGrantSelf | 2 | D08005/06 | 単一実印刷 |
| enterDrawDiscard | 2 | D08015/16 | 単一実印刷 |
| cutinTraitScaling | 2 | D08007/08 | 単一実印刷 |
| enterStunSleep | 2 | D08019/20 | 単一実印刷 |
| hiramekiCharActivate | 2 | D11003/04 | 単一実印刷 (hiramekiCharX 共通基底化検討) |
| enterEvidenceManip | 2 | D08013/14 | 単一実印刷 |
| triggerOnAttack | 2 | D08021, D11015 | 形が違う (続効果差) |
| enterSelfBuffIfTraitN | 2 | D08011/12 | 単一実印刷 |
| shippuEvidenceGain | 2 | D11003/04 | 単一実印刷 |
| shippuCharSleep | 2 | D11009/10 | 単一実印刷 |
| declaredSelfSleepRemoveByAP | 2 | D11003/04 | 単一実印刷 |
| declaredSelfSleepProvoke | 2 | D11005/06 | 単一実印刷、要 G28 (mustBeTargeted) |
| enterRemoveByOwnAP | 2 | D11005/06 | 単一実印刷、要 G24 (動的式 $self.ap) |
| expandTargetable | 2 | D11007/08 | 要 G29 (flow.action 拡張機構) |
| contactRevenge | 2 | D11007/08 | 公式テキスト不完全 |
| eventRemoveByAP | 2 | D08025, D11020 | パラ化簡単 → 確定クラスに昇格検討 |

## 確定クラスに格上げ提案 (本セッション末で確定)

caseResolvedHandRemove / caseDeclaredEvidenceFlip / eventRemoveByAP は 2枚しかないが「**ペア重複ではない**」「**複数弾跨ぎ**」のため、共通クラス化価値が高い → **格上げ確定**。

→ **最終的な cards/_shared/ クラス: 9件 (確定6 + 格上げ3)**

## 1枚 (個別実装)

D08021 enterStackFromRemove / stackCountThreshold, D11012 ヒラメキ系全般, D11014 declaredSleepHandRemoveReanimate, D11016 guardCounterReact, D08024 eventReanimate, D11019 eventRevealUntilEnter, D11013 cutinConditionalDraw, D11015 enterConditionalGrant, D11020 eventRemoveBySleep, D11020 conditionalSecondaryEffect, D11014 shippuTargetAPMinus

## 関連
- [INDEX.md](INDEX.md) — 47枚進捗
- [../engine-api-card-abilities.md](../engine-api-card-abilities.md) — AbilityDef
- [../CLAUDE.md](../../CLAUDE.md) — 共通クラス運用 (破壊的変更禁止)
