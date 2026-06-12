# 実装保留 (Deferred) 一覧

本ファイルは「実装はあるが未完成 or 未着手で先送りされた」項目の集約 INDEX。
新規 defer を生んだ commit / session log は必ずここに 1 行追加すること。

## 公式 defer 宣言済 (専用ファイルあり)

| Phase | 内容 | 専用 spec |
|-------|------|----------|
| Phase 5 advance | Souza Sub-task B / C | `phase-5-advance-souza-deferred.md` |
| Phase 9-F.2 | MCTS policy 強化 | `src/ai/policies/mcts.ts:10` コメント |

## Round/Phase 単位の繰越 (memory / session log 経由)

| 繰越元 | 内容 | 状況 |
|--------|------|------|
| Cleanup Phase 中/大規模 #1 | 動的式評価括弧 | `src/engine/dyn/eval.ts:13,145` TODO Phase 5 |
| Cleanup Phase 中/大規模 #2 | AI コスト選択ロジック拡張 | undocumented (S148 session log のみ) |
| Cleanup Phase 中/大規模 #3 | AI ヒューリスティック「有用カード操作」(大) | undocumented |
| Cleanup Phase 中/大規模 #6 | Playmat レスポンシブレイアウト | undocumented |
| Cleanup Phase 中/大規模 #9 | 触発 listener 漏れ | undocumented |
| BUG-006 | GuardPickerModal が active 状況で開かず E2E skipped | `tests/e2e/bug-006.spec.ts` skip 継続 |
| BUG-036 | refresh ok:false 時 gameResult 未配線 | ✅ 修正済 (`1480465` / 2026-05-22) |

## コード TODO grep 結果 (2026-05-21)

| ファイル | 行 | 内容 |
|---------|----|----|
| `src/ai/policies/mcts.ts` | 10 | Phase 9-F.2 (deferred) |
| `src/engine/effect/resolver.ts` | 17, 37 | Phase 4+ で並列セマンティクス検討 |
| `src/engine/flow/setup.ts` | 14 | engine.rng singleton 化検討 |
| `src/engine/flow/setup.ts` | 200 | PlayerState.faceUp when UI requires reveal() |
| `src/engine/flow/action/state-machine.ts` | 44 | Phase 5: パートナー AP 修正効果対応 |
| `src/engine/dyn/eval.ts` | 13, 145, 215 | Phase 5: 括弧 / turnEffect integration |
| `src/engine/cards/tsv-loader.ts` | 70, 78, 148 | Phase 5: 『 』/ ( ) 分割、caseTraits 推定 |
| `src/engine/listeners/misread.ts` | 121 | Phase 5: reasoning:end の cleanup listener |
| `src/cards/ct-d11/D11005.ts` | 19 | Phase 5+: source uid 伝播 |
| `src/cards/ct-d11/D11007.ts` | 13 | Phase 5+: action canActionAgainstChar selectorPatch |
| `src/engine/cost/pay.ts` | 8 | Phase 3.10: viaCost wire |

## user_request 20260521_01 由来 (本 plan 由来の繰越候補)

| user_request # | 内容 | BUG ID 候補 |
|---------------|------|------------|
| #18 (umbrella) | カード個別実装が機能していない | BUG-043 (audit umbrella) |

## カード実装 defer (engine ゲート起因)

| 起因 | 内容 | 状況 |
|------|------|------|
| 2026-06-04 pilot | catalog-reuse「reusable 306」は過大評価。最易30枚中 実装可2枚のみ。残はevent→evidence/leave・reasoning hook無/continuous他者buff/手札数condition/カットインfilter等の engine ゲート | ゲート一覧: [card-impl-engine-gates.md](card-impl-engine-gates.md)。reusable+unclassified の **engine-gate 再分類** が必要 |
| 2026-06-04 pilot | workflow harness: schema 付き subagent が StructuredOutput 未呼びで 0-token 即終了 (30/30 fail) | 量産 harness として要調査。pilot 2枚は手実装で代替 |

## 運用

- 新規 defer が発生したら本ファイルに追加 + 該当 BUG-XXX.md または spec doc に
  リンク
- 月次 cleanup phase で本リストを見て解消可能項目を洗い出す
- `.claude/auto/` の mapping/state docs と整合性確認は手動 (auto-gen 対象外)

## Task D engine拡張 wave#1 繰越 (2026-06-12, session log 2026-06-12.md)

| 項目 | 内容 | 解禁条件 |
|------|------|---------|
| mustGuard token | 「ガードできる場合、必ずガードする」(B09040 a2) | guard 強制の AI/UI 同時追従 (GuardPickerModal forced 化) |
| auraGrant | 常時 aura で他キャラに triggered 付与 (B09024 a1) | continuous OWNER-ONLY 制約の解除 + 二重 queue 防止 |
| partner-area 構造 | ビッグジュエル B07045 / MR 列挙 B09047 / MR能力①② (rules/18) | GameState slot + UI (次 wave 最終段) |
| 「パートナーエリアでも宣言できる/発動する」句 | B07079/P・B08032/P・B09054/P (今回出荷分) + B07093/B05066 (前例) は句を vacuous 扱いで出荷 | partner-area キャラ slot 実装後に句を有効化 |
| name-designation | 「カード名を1つ指定し」UI+条件 (B09003/B09108/B09111/B09052) | 宣言 UI surface + designated-name 比較 condition |
| multi-card sceneEnter | 「2枚まで選び登場」(B09010) | sceneEnter の cardIds multi 契約対応 |
| nested filter dyn | 「FILE枚数以下のレベル」filter 注入 (B08060/B05102/B09052) | resolveDynArgs の深掘り解決 |
| until-N discard / reveal verb 等 | B07076/B07100/B08047 a2/B08093 a1 | 可変 count atom / hand-reveal verb |

## Task A green候補 wave#2 defer (2026-06-12, cards/wave2-handauthor)

| rep | 理由 | 解禁条件 / 備考 |
|-----|------|----------------|
| ~~B08020/P~~ | **✅ 再採用済 (2026-06-12 engine拡張 wave#2)**: BUG-132 GAP-1/2 修正 (chooseMatch decline channel + declaredBatch gate/遅延 pick) 後に hand-author で出荷。実機 decoy 検証済 (a1 色+kind filter / decline / a2 解決順+AP filter) | 完了 — branch engine/wave2-bug132 |
| B07052 | **data-gate**: 〚特徴［赤魔術］〛が全カード/事件の features に未投入。caseTrait 赤魔術 (【事件赤魔術】) も deckRevealUntil filter:{trait:'赤魔術'} も永久不一致 → 実装すると無音 no-op。certify は filter 機構のみ検証しデータ未確認 (harvest comment 'yellow event-trait gate' が正) | 赤魔術 を事件/イベント trait に投入後 (データ補完) 再 certify。**横展開: 出荷済 B07062 a2 の handAddFromRemove filter:{trait:'赤魔術'} も同 data-gate で latent no-op (解決編+bond小泉紅子+cost gate で発火稀)** |
| B02026 | refuted(fatal): a1 triggerCharMatches {side:'opp'} filter 無し → 相手パートナーの action でも誤発火 | filter:{kind:'character'} 追加 + 再 certify |
| B07104 | refuted(fatal): 【パートナー黒】を step1 のみ conditional 化 (全 ability gate が正) + PA pick 非終端 step で二重 grant desync | ability.condition 化 + PA ordering 対応 |
| B09038 | refuted(fatal): chain が 0 候補時に強制 draw を誤抑制 (sequence が正) | chain→optional{sequence} 化で容易に green、次 wave |
| B09097 | refuted(fatal): bare-chain optional が CPU で強制 discard 化 | {kind:'optional',effect:{chain}} ラップ + 再 certify |

## engine拡張 wave#2 (BUG-132 修正) 繰越 (2026-06-12, engine/wave2-bug132)

| 項目 | 内容 | 状況 |
|------|------|------|
| B01048/P identity 選択 | 「その中からカードを1枚手札に加え」(まで無し・filter無し maxN:3) — count は公式Q&Aで強制確定済だが「どの1枚か」の選択主体は明文なし。現状は先頭自動 | chooseMatch:'forced' 変種 (nMin=1) で同 infra 対応可。公式Q&A照会 or ユーザー確認後 |
| AI の decline 判定 | chooseMatch の AI 経路は常に先頭取得 (合法手内固定戦略、baseline 安定優先)。「まで」=0枚可を AI が戦略判断する heuristic は未実装 | HeuristicPolicy 拡張 (BUG-132 防止策メモ参照) |
| カットイン使用への第三者反応の解決ポイント | rules/09・22・23 に記載なし (自効果先行の不変条件のみ gate 実装済) | 公式 Q&A 照会後 |
| BUG-133〜136 | drain player guard / queue時pick確定の他hook一般化 / skip-drop精査62件 / デッキ下順序選択 | 各 BUG-XXX.md 参照 (調査データ添付済) |
