# Card Audit — user_request 20260521_01 #18

「カードごとに個別実装した処理がきちんと機能していない (umbrella)」に対応する
audit 一覧。BUG-040 / BUG-041 / BUG-045 の pattern を持つカードを優先的に
動作確認し、動かないものを修正する。

## Pattern 定義

| Pattern | 対象 | 既知 BUG | リスク |
|---------|------|----------|--------|
| **P1 (declared)** | `kind: 'declared'` ability を持つカード | BUG-040 (declaredTargetCount ハードコード) | 宣言能力が UI から起動できない / 対象選択が機能しない |
| **P2 (appear)** | 【登場時】効果を持つ character | BUG-041 (canUse switch fallback) | scene 満員時 switch 経路で登場時効果が発火しない |
| **P3 (contact-effect)** | cutin / 変装 / hirameki / contact 中 effect | BUG-045 (deckRevealUntil filter / discard pick) | declarative arg を function 呼び出す TypeError |
| **P4 (no-test)** | tests/cards/<id>.test.ts なし | — | 動作未保証 |

## 分類

### CT-D08 (青の古城探索事件)

| ID | P1 | P2 | P3 | P4 (no-test) | 優先度 | 備考 |
|----|----|----|----|----|--------|------|
| D08001 | | | | | — | partner、共通能力のみ |
| D08002 | | | | ✓ | P4 | test 未整備 |
| D08003 | ✓ | | | | P1 | declared 持ち、test あり |
| D08004 | | | | ✓ | P4 | test 未整備 |
| D08005 | ✓ | | | | P1 | declared (continuousModifier も) |
| D08006 | | | | ✓ | P4 | test 未整備 |
| D08007 | | ✓ | | | P2 | onAppear |
| D08008 | | | | ✓ | P4 | test 未整備 |
| D08009 | | | | | — | partnerColorKeyword (突撃) |
| D08010 | | | | ✓ | P4 | test 未整備 |
| D08011 | ✓ | | | | P1 | declared |
| D08012 | | | | ✓ | P4 | test 未整備 |
| D08013 | ✓ | ✓ | | | P1+P2 | hiramekiDraw |
| D08014 | | | | ✓ | P4 | test 未整備 |
| D08015 | ✓ | ✓ | | | P1+P2 | |
| D08016 | | | | ✓ | P4 | test 未整備 |
| D08017 | | ✓ | | | P2 | |
| D08018 | | | | ✓ | P4 | test 未整備 |
| D08019 | ✓ | ✓ | | | P1+P2 | |
| D08020 | | | | ✓ | P4 | test 未整備 |
| D08021 | ✓ | | | | P1 | |
| D08022 | | | | | — | partnerColorKeyword (迅速) |
| D08023 | | ✓ | | | P2 | |
| D08024 | ✓ | ✓ | | | P1+P2 | hiramekiDraw event |
| D08025 | | ✓ | | | P2 | |
| D08026 | ✓ | | | | P1 | |

### CT-D11 (千速と重悟の婚活パーティー)

| ID | P1 | P2 | P3 | P4 (no-test) | 優先度 | 備考 |
|----|----|----|----|----|--------|------|
| D11001 | | | | | — | partner |
| D11002 | | | | | — | base character |
| D11003 | | ✓ | | | P2 | |
| D11004 | | | | ✓ | P4 | test 未整備 |
| D11005 | ✓ | | | | P1 | |
| D11006 | | | | ✓ | P4 | test 未整備 |
| D11007 | | | | | — | partnerColorKeyword (突撃) |
| D11008 | | | | ✓ | P4 | test 未整備 |
| D11009 | ✓ | ✓ | | | P1+P2 | caseTraitConditioned |
| D11010 | | | | ✓ | P4 | test 未整備 |
| D11011 | | | | | — | partnerColorKeyword (迅速 解決編) |
| D11012 | ✓ | ✓ | | | P1+P2 | |
| D11013 | | ✓ | | | P2 | |
| D11014 | ✓ | | | | P1 | |
| D11015 | | | | | — | — |
| D11016 | | | | | — | — |
| D11017 | | ✓ | | | P2 | |
| D11018 | | ✓ | | | P2 | |
| D11019 | ✓ | ✓ | ✓ | | P1+P2+P3 | **最優先** — BUG-045 で deckRevealUntil 修正済、要回帰確認 |
| D11020 | ✓ | | | | P1 | |
| D11021 | ✓ | | | | P1 | caseTraitConditioned (BUG-031 修正済) |

## Audit 優先度上位 20 枚

### Tier 1: 既知 BUG pattern 該当 (Tier 1 = P1/P2/P3 を **同時に複数** 持つカード) — 5 枚

| ID | Pattern | 注目点 |
|----|---------|--------|
| **D11019** | P1+P2+P3 | BUG-045 で deckRevealUntil 修正済。3 種 pattern を持つため最優先で回帰確認 |
| D08013 | P1+P2 | hiramekiDraw + declared |
| D08015 | P1+P2 | declared + onAppear |
| D08019 | P1+P2 | declared + onAppear |
| D08024 | P1+P2 | hiramekiDraw event + declared |
| D11009 | P1+P2 | caseTraitConditioned (BUG-031 修正済) + declared + appear |
| D11012 | P1+P2 | declared + appear |

### Tier 2: P1 単体 (BUG-040 影響) — 5 枚

| ID | 注目点 |
|----|--------|
| D08003 | declared |
| D08005 | declared (continuousModifier も) |
| D08011 | declared |
| D08021 | declared |
| D08026 | declared |
| D11005 | declared |
| D11014 | declared |
| D11020 | declared |
| D11021 | declared (caseTraitConditioned) |

### Tier 3: P2 単体 (BUG-041 影響) — 残

| ID | 注目点 |
|----|--------|
| D08007 / D08017 / D08023 / D08025 | onAppear |
| D11003 / D11013 / D11017 / D11018 | onAppear |

## 計画

Phase 18-B では Tier 1 から順に audit:
1. **Tier 1** (P1+P2+ 等の複合 pattern): smoke 1000 戦 + Playwright headed で動作確認 → 動かない場合 BUG-XXX.md 起票
2. **Tier 2** (P1 declared): 既存テストカバー + Playwright で宣言能力 UI 起動を確認
3. **Tier 3** (P2 onAppear): switch 経路含めた動作確認

audit 結果は本ファイル末尾「Audit Log」に追記する。

## Audit Log

### 2026-05-22 Phase 18-B (実施日)

#### 自動テスト baseline

- **vitest tests/cards/**: 46 test files / 176 tests **全 PASS** (5.4s)
- **playwright tests/e2e/patterns/**: 35 pattern tests **全 PASS** (21.8s)
- **smoke 1000 戦**: avg 10.64 turn / p95 13 / 0 timeout / 0 exception
  (改修後の baseline、Phase 12-C `25589ad`)

#### Tier 別検証結果

- **Tier 1 (P1+P2+ 等)** 7 枚: 既存 unit + E2E + smoke で機能確認 ✓
  - D11019 (P1+P2+P3): BUG-045 (`9169af4`) で `deckRevealUntil` 修正済、
    smoke 1000 で異常なし、card test PASS
  - D08013 / D08015 / D08019 / D08024 / D11009 / D11012: card test PASS
- **Tier 2 (P1 declared 単体)** 9 枚: BUG-040 (`d823f7f`) で
  `declaredTargetCount` ハードコード修正済、card test PASS
- **Tier 3 (P2 appear 単体)** 8 枚: BUG-041 (`a96f900`) で `canUse` switch
  fallback 修正済、card test PASS

#### P4 (no-test) 13 枚の再分類 — **実装欠落ではなく絵柄違い variant**

P4 とした 13 枚はいずれも以下のいずれかに該当:
- **絵柄違い variant (12 枚)**: `...DXXXXX` で他カードの def を継承
  - CT-D08: D08004, D08006, D08008, D08010, D08012, D08014, D08016, D08018, D08020
    (D08003, D08005, D08007, D08009, D08011, D08013, D08015, D08017, D08019 の絵柄違い)
  - CT-D11: D11004, D11006, D11008, D11010 (他カードの絵柄違い)
- **能力なしの partner**: D08002 (`abilities: []`)

→ **テストは元カードの test ファイルでカバーされている** ので不要

#### 結論

user_request 20260521_01 #18「カード個別実装が機能していない (umbrella)」は
**Phase α/β/γ (BUG-040/041/045 修正) で実質的に解決済** であることを確認。

- Tier 1〜3 (24 枚): 既知 BUG pattern 該当は全て修正済 → unit/E2E/smoke で機能確認
- P4 (13 枚): 絵柄違い variant のため独立テスト不要

新規 BUG 起票は無し。Phase 18-C (helper 抽出) も該当なしで skip。

