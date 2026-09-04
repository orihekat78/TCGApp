# Phase 5: cards/_shared/ 9 + 47カード実装

**Goal:** [shared-classes/INDEX.md](../../../specs/shared-classes/INDEX.md) の 8 spec を実装し、[cards-analysis/](../../../specs/cards-analysis/) の 32 ユニーク分析を 47 CardDef にして登録。CardDB から TSV (`cards-data/`) でメタを読み込む。

**Files:**
- Create: `src/cards/_shared/{partnerColorKeyword,cutinFixedAP,hiramekiCharStun,hiramekiDraw,caseTraitConditioned,caseResolvedHandRemove,caseDeclaredEvidenceFlip,eventRemoveByAP,index}.ts`
- Create: `src/cards/{ct-d08,ct-d11}/D*.ts` (32 unique × ~10-30LOC)
- Create: `src/cards/registry.ts` (TSV ローダ)
- Test: `tests/cards/_shared/*.test.ts`, `tests/cards/D*.test.ts`

---

### Task 5.1: TSV ローダ (engine.cards.load)

- [ ] テスト: `loadSet('CT-D08')` で 26枚の partial CardDef (メタのみ) が返る
- [ ] 実装: TSV パース + CardDB に登録 (effect/abilities は空のまま)

### Task 5.2: cards/_shared/ 8 共通クラス (spec → ts)

各 spec から 1ファイル ts 実装。1 共通 = 1 task:

- [ ] 5.2a partnerColorKeyword.ts + test (5枚カード適用)
- [ ] 5.2b cutinFixedAP.ts + test (7枚)
- [ ] 5.2c hiramekiCharStun.ts + test (4枚)
- [ ] 5.2d hiramekiDraw.ts + test (4枚)
- [ ] 5.2e caseTraitConditioned.ts + test (4枚)
- [ ] 5.2f caseResolvedHandRemove.ts + test (2事件)
- [ ] 5.2g caseDeclaredEvidenceFlip.ts + test (2事件)
- [ ] 5.2h eventRemoveByAP.ts + test (2イベント)

各 task: spec 通りシグネチャ → AbilityDef 返却 → cardDef.abilities に組込テスト。

### Task 5.3: パートナー4枚 (D08001/02 + D11001/02)

- [ ] CardDef abilities=[] (骨格内蔵)
- [ ] テスト: アシスト・事件解決が engine から動作
- [ ] commit

### Task 5.4: 事件2枚 (D08026, D11021)

- [ ] caseResolvedHandRemove + caseDeclaredEvidenceFlip 適用
- [ ] テスト: 解決編移行→手札リム / 宣言コスト→AP修正

### Task 5.5: イベント4枚 (D08024, D08025, D11019, D11020)

- [ ] D08024: eventReanimate 個別実装 + hiramekiDraw
- [ ] D08025: eventRemoveByAP({apMax:8000, condition:partnerColor青})
- [ ] D11019: eventRevealUntilEnter 個別 (G18 deckRevealUntil) + cutinFixedAP({delta:1000})
- [ ] D11020: eventRemoveByAP 2段階

### Task 5.6: キャラ22 unique (各 1 task)

cards-analysis に従い:

| Card | task | 主構成 |
|------|------|------|
| D08003/04 | 5.6a | enter+optional+condition+turnEnd ドロー |
| D08005/06 | 5.6b | continuousAPperEvidence + declaredFlipForGrantSelf |
| D08007/08 | 5.6c | cutinTraitScalingAP |
| D08009/10 | 5.6d | partnerColorKeyword |
| D08011/12 | 5.6e | enterSelfBuffIfTraitN |
| D08013/14 | 5.6f | enterEvidenceManip + hiramekiDraw |
| D08015/16 | 5.6g | enterDrawDiscard + cutinFixedAP |
| D08017/18 | 5.6h | cutinFixedAP |
| D08019/20 | 5.6i | enterStunSleep (caseStatus) + hiramekiCharStun |
| D08021 | 5.6j | enterStackFromRemove + stackCountThreshold (G26/G27) |
| D08022 | 5.6k | partnerColorKeyword |
| D08023 | 5.6l | cutinFixedAP |
| D11003/04 | 5.6m | shippuEvidenceGain + caseTraitConditioned + hiramekiCharActivate |
| D11005/06 | 5.6n | enterRemoveByOwnAP (G24 動的式) + declaredSelfSleepProvoke (G28) |
| D11007/08 | 5.6o | expandTargetable (G29) + partnerColorKeyword + contactRevenge (cost1+self+3000) |
| D11009/10 | 5.6p | partnerColorKeyword + shippuCharSleep + hiramekiCharStun |
| D11011 | 5.6q | partnerColorKeyword + caseStatus 解決編 |
| D11012 | 5.6r | declaredSelfDeckBottomBuff + hiramekiReanimateName (G30) |
| D11013 | 5.6s | cutinFixedAP + cutinConditionalDraw |
| D11014 | 5.6t | shippuTargetAPMinus + declaredHandRemoveReanimate |
| D11015 | 5.6u | triggerOnAttack + enterConditionalGrant |
| D11016 | 5.6v | guardedSelectedSourceReact |
| D11017/18 | 5.6w | cutinFixedAP |

各 task: ability dsl テスト (能力単体動作) + 1ゲーム内挙動テスト

### Task 5.7: validateAll + 起動時バッチ

- [ ] テスト: 全47枚が validate 通過
- [ ] テスト: ruleRefs 実在チェック

## 完了基準

- 47枚 CardDef 登録完了
- 8 共通クラスが3+枚に適用済
- 各カード ability の単体テスト PASS

→ Phase 6 へ
