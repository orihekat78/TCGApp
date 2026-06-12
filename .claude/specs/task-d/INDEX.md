# Task D — engine 拡張 (高リスク) 設計 INDEX (2026-06-12)

user 指示で着手 (骨格凍結原則の user 承認例外、engine-extension-plan.md の最終段)。
🟡 678枚のうち優先度上位 4 gate + 横断 1 micro-extension を additive 実装する。
設計は 2026-06-12 grounding workflow (9 agents、全 file:line 実コード照合 + 敵対検証) に基づく。

## 拡張一覧 (実装順 = リスク昇順)

| # | spec | 内容 | 解禁 (完全) |
|---|------|------|------------|
| E1 | [01-hand-count-condition.md](01-hand-count-condition.md) | Condition 3種 (handAtLeast/handAtMost/handCountAtLeastOther) | B09092(P)/B07081 |
| E0 | [02-scene-to-deck.md](02-scene-to-deck.md) §pick-bind | Pattern A pick の bind writeback (横断 pick-share 解消) | (下記各所) |
| E2 | [02-scene-to-deck.md](02-scene-to-deck.md) | sceneToDeck verb + sceneToDeckBottom cost + triggerCharMatches.excludeSource | B07080(P)/B04011/B08058(P)/B09002(P) a1 |
| E3 | [03-file-zone.md](03-file-zone.md) | fileRemoveTop/fileFlipTop verb + fileTopMatches/triggerPlayerIs cond + file:pop hook + 既存バグ2修正 | B09021(P)/PR100/PR106/B04064/B04068(P)/B05050 |
| E4 | [04-textual-grant.md](04-textual-grant.md) | hasTextAbility reader + 6 token 配線 + charGrantAbility verb + duration 拡張 | B08037(P)/B09028/PR181/B09054(P)/B09032/B07090(P)/B08029(P)/B08032(P)/B02014/B07070 |

partner-area 構造 (B07045/B09047) は本 wave に含めない (GameState+UI 大規模、別 spec で最終段)。

## 共通安全手順 (engine-extension-plan.md §安全手順 準拠)

1. baseline: full vitest green (2026-06-12 時点 1899 pass / 1 skip) 確認済
2. 各拡張: TDD (unit 先行) → additive 実装 → `npm run typecheck` + full vitest 回帰0
3. 対応カード実装 (card-addition-checklist 全通し) → `tests/cards/*-batch.test.ts`
4. e2e: `tests/e2e/engine-extensions-2026-06-05.spec.ts` + `reuse-cards-2026-06-05.spec.ts` 回帰 + 新規 spec 追加
5. `npm run smoke:1000` exceptions=0 / Playwright text-faithfulness (checklist §7、decoy 必須)
6. docs: `npm run docs` 再生成 / changelog entry / `scripts/taskA-validate-specs.cjs` の VERBS/CONDS whitelist 同期

## 既存バグ (本 Task で発見・修正)

- BUG-128: `filePopToHand` が実 cardId でなく placeholder 'card-back' を手札に push (next-hint.ts は Round 3 修正済で非対称)。使用カード0で latent
- BUG-129: cost `fileFrom` が popTop 戻り値破棄→カードがゲームから消失 (remove 行き欠落、リフレッシュ母数バグ)。canPay 側も assisted-partner 込み計数 (rules/21 違反)。影響 B05037
- BUG-130 (起票のみ): B02040.ts の uid:'$pick' 第2 atom が pick-share 機構欠如で silent no-op の疑い → E0 で機構導入後に検証・修正

## 検証で確定した還元事項 (過大評価の防止)

- B09010: multi-card sceneEnter (cardIds 契約) 欠如で unlocked ではない → DEFER 継続
- B09003/B09108/B09111/B09052: name-designation (カード名指定 UI+条件) が全 engine に不存在 → partial
- B09052/B08060/B05102: nested filter dyn ($self.fileCount を filter.levelMax に注入) 別 gate
- B07076/B07100: until-N discard / hand-reveal verb / cutin-禁止 turnFlag 等で still-blocked
- 「パートナーエリアでも宣言できる」句: partner-area キャラ slot 不存在で vacuous (B07093 a2 出荷前例に従い本体句のみ実装、句は DEFERRED-INDEX に明記)

## rules 網羅 (全 spec 共通参照)

03(エリア/状態) 05(FILE積順) 07-10(アクション系) 12(ネクストヒント) 13-17(キーワード/アイコン)
14+26(リフレッシュ) 15+25(効果解決/即時例外) 16(セット) 19(分割名/特殊) 21(宣言コスト) 22-24(Q&A)。
各 spec に該当節を明記。touched files・edge cases・カード verdicts は各 spec 参照。
