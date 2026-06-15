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

## 2026-05 スナップショット (アーカイブ)

- コード TODO grep 結果 (2026-05-21) / user_request 20260521_01 繰越候補 → [DEFERRED-ARCHIVE-2026-05.md](DEFERRED-ARCHIVE-2026-05.md)

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
| ~~B07052~~ | **✅ 解決済 (2026-06-15 赤魔術 family)**: 「赤魔術 はどのカードにも無い」は **stale 誤認**。一次 API の `category1/2/3` (特徴の正本) に 赤魔術 が実在 (B07055/B07058 event, B07062 case)。TSV 抽出が event/case の category-trait を全件 drop していたのが真因 (field-drop, BUG-124 同族)。per-card で trait 補完 → B07052 実装 + B07062 latent 解消 | 完了 — branch cards/akamajutsu-trait (changelog 2026-06-15-04)。残課題は下記 known-gap |
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

## engine拡張 wave#2 cluster2 (ability-presence filter) defer (2026-06-12, engine/wave2-ability-filter)

| rep | 理由 (支配 gate) | 解禁条件 |
|-----|------------------|---------|
| B08078/P | a2「リムーブしたカードの【現場リムーブ時】の効果を発動させてもよい」= 他カード hook 効果の外部発火機構が engine に不存在 (grep 0 hit、cluster2 最難)。a1 は X1+sceneHas で可能だが partial 出荷はしない | 外部発火機構の設計 (独立クラスタ) |
| B08082 | a1 効果側 handReveal verb 不在 +「【黒】以外」color negation filter 不在 | handReveal verb + negation filter |
| B03133 | handAddFromRemove が単一 target のみ (「2枚まで手札に加える」不可) | multi-target handAddFromRemove |
| B06020 | **triage 誤分類** (cutin-subtype filter ではなく「手札 zone への continuous aura 付与」+ startContact stub)。a1 = hand aura (continuous は owner/scene 限定)、a2 = startContact placeholder | hand-zone aura + startContact 実装 (wave#1 繰越 auraGrant と同族) |
| B07098/P | 「リムーブエリアにある【カットイン】を持つ【黒】のカード1枚につき AP+1000」の remove-area keyword-count dyn 不在 (cost/存在判定は X1 で可能) | remove-count dyn 拡張 |
| B07102 | 「好きな枚数リムーブし、同じ枚数引く」= 可変枚数 select + count 結合 dyn 不在。0枚可否も一次資料なし (要公式照会) | variable-count select + $discarded.count dyn |

### cluster2 で記録した既知ギャップ (カード defer ではない)

| 項目 | 内容 | 状況 |
|------|------|------|
| 付与能力の presence | B07100 qAndA は「付与も持つ」だが defHasKeyword は CardDef 静的のみ (turnEffects 付与分は不参加)。cluster2 出荷 10枚には grant 源が共存しないため実害なし | B07100 (handReveal gate) 出荷時に state-aware reader へ拡張 |
| 能力無効化中の presence | rules/19 文理は「持たない」だが既存 4 アイコンも static 判定 (無効化中も match)。直接 Q&A なし | 要公式照会 (talk002) |
| 疾風×名乗り例外の rules 不整合 | rules/03・06 は疾風を名乗り例外に列挙、rules/13 は迅速/突撃のみ。engine は疾風の naming-exception 未実装 | 公式 PDF 再確認 (impl lens F9、独立タスク) |
| ~~BUG-140 残 74枚~~ | **✅ 補修済 (2026-06-13 BUG-140 wave)**: 52 ファイル直接 patch + 22 spread 継承。`npm run lint:icon-abilities` 化 (CI 規約 8 本目)。DEFER 2 枚は下記 | 完了 — branch fix/bug-140-icon-abilities |

## BUG-140 補修 wave defer (2026-06-13, fix/bug-140-icon-abilities)

| rep | 理由 (支配 gate) | 解禁条件 |
|-----|------------------|---------|
| B05039 | cutin「〚特徴［探偵］〛のキャラに【カットイン】した場合、カードを1枚引く」— コンタクト対象キャラ ($contact.byUid) の特徴を評価する Condition が union に不在 (triggerCharMatches は trigger payload uid 限定)。AP+1000 のみの partial 出荷は語義不一致のため見送り | contact-char trait condition 追加 (lint allowlist `B05039:cutin` と同期) |
| B06035 | hirameki「【事件YAIBA】【解決編】手札を1枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、リムーブする」— hirameki fire 経路 (hiramekiResolve の chooseAtomTarget auto-resolve) 内での chain (してもよい→そうした場合) + caseTrait/caseStatus 条件 gate の挙動が未確証 | fire 経路の chain/condition 検証後に再採用 (lint allowlist `B06035:hirameki` と同期) |

## engine拡張 wave#2 cluster3 (action-lifecycle trigger) defer (2026-06-13, engine/wave2-action-triggers)

| rep | 理由 (支配 gate) | 解禁条件 |
|-----|------------------|---------|
| B06049 | a2「アクション終了時まで相手の【ヒラメキ】は発動しない」= ヒラメキ抑止機構 + side-level「アクション終了時まで」flag が engine に不存在 (hirameki.ts / handleEvidenceRemovedHook に抑止参照点なし、turnEffects は per-char)。a1 突撃句は X8(enter+sceneHas) で可能だが partial 出荷はしない (cluster 方針) | ヒラメキ抑止窓 (side-level action-scope flag) の設計 (独立クラスタ) |

### cluster3 で記録した既知ギャップ (カード defer ではない)

| 項目 | 内容 | 状況 |
|------|------|------|
| reasoning 由来の証拠獲得 refresh | `flow/main/reasoning.ts` の addFromDeck も deck0 で refresh 未配線 (BUG-142 と同族)。本クラスタは action[事件] 限定のため未修正で繰越 | reasoning ループに fileAdd 同型 guard 追加 (BUG-142 水平展開、別 commit) |
| contact-scope mod の清掃タイミング | apMod_contact 等が contact-end でなく turn-end で清掃 (rules/08 §6 違反)。同ターン複数コンタクトで stale。決定論 grep で実在確認 | BUG-143 (cluster3 外、出荷済カットイン回帰要のため独立 commit) |
| case アクションの CPU ガード窓 | resolveActionAgainstCase が passGuard 固定 (rules/07-08 はアクション[事件]もガード可)。AI-vs-AI でブレットが観測上無意味 | BUG-144 (cluster3 外、smoke baseline 変動のため独立 commit) |
| U1 変装での actor 帰属 | コンタクト中変装で入替先キャラの「このキャラのアクション〜」帰属が移転するか rules/23 に記載なし | 要公式照会 (talk002) |
| U2 actor 離場後の gain 発動 | actor が証拠獲得前に離場した場合の b群 trigger 発動可否 (engine 自然挙動=不発、PR086 qAndA と整合的) | 要公式照会 |

## engine拡張 wave#2 cluster4 (remove-area → deck-bottom) defer (2026-06-14, cards/wave2-cluster4)

| rep | 理由 (支配 gate) | 解禁条件 |
|-----|------------------|---------|
| B07025 | triage 誤分類。cost は sceneToDeckBottom (現場→デッキ、実装済) であり remove-area cost ではない。effect「コストでデッキ下に移したキャラのレベル以下のレベルの特徴[マジシャン]を手札に加える」= 動的 levelMax-from-cost filter (costPaid のレベル捕捉 + dyn 値の pick-query filter 解決) が両方とも不在 | costPaid level 捕捉 + dynamic-value filter (levelMax:{dyn:'$cost...'}) の実装 (別クラスタ) |

### cluster4 で記録した既知ギャップ (カード defer ではない)

| 項目 | 内容 | 状況 |
|------|------|------|
| B08066 leave:remove-area 反応 | 公式Q&A は removeAreaToDeckBottom cost で《諸伏高明/0585》《大和敢助/0586》の「リムーブエリアから離れたとき」発動を要求。engine に `leave:remove-area` hook 不在 (TRIGGERED_HOOKS は leave:to-remove=現場→remove のみ) + 反応元 B05087/B05088 未実装のため安全に DEFER (盤面に反応カードなし) | それら実装時に leave:remove-area hook 追加 + removeAreaToDeckBottom pay の emit 再配線 (B05088 が同 cost 共有) |
| removeAreaToDeckBottom UI picker | first-n fallback (sceneToDeckBottom 同 posture)。複数候補時に人間が選べない (UX 制限、rules 誤りではない) | costParams.removeAreaToDeckBottom.ids 配線済 → RemoveAreaCostPickerModal を drop-in 追加 (engine 変更不要) |

## ✅ self-state micro-cluster (BUG-145, 2026-06-15 修正済) — self-sleep optional gate

PR138 latent bug (reanimate certify の self-1対1 レビューで検出した certify false-green) を起点に、
「**このキャラをスリープさせ(…)てもよい。そうした場合、X**」型の self-sleep optional が already-sleep 時に
gate されない問題を解決。`charStateIs{ref,state}` 条件を追加し (engine 4点同期)、対象 **11 能力**に
`condition: not{charStateIs(ref:self, state:'sleep')}` を AND マージ。詳細・カード一覧は [BUG-145](../bugs/BUG-145.md)。

- gate は **sleep のみ** (active 案は不採用)。自スタン (PR157/PR163) は already-sleep でも可 = 公式 sleep/stun 非対称。
- 敵対 verify (opus×14): 11 能力 全 CORRECT / 除外 13枚 MISS 0。
- B06052 / D05006 は同 reanimate 族だが self-sleep cost なしのため正しく対象外 (前 batch 出荷済・意味等価 pass)。

## 赤魔術 trait family 残 DEFER + known-gap (2026-06-15-2, cards/akamajutsu-family-2)

family残 5枚を certify (opus adversarial)。3枚解禁 (B07031/B07038/B07047, ALL_CARDS 1171→1174)、2枚 DEFER。

| rep | 理由 (支配 gate) | 解禁条件 |
|-----|------------------|---------|
| B07034 / PR231 (小泉紅子, text 同一) | a1「自分の現場のキャラに裏向きでセットされているカードが1枚現場から離れるたび、カードを1枚引く」(【自分ターン中】【ターン2】) = **set-card-leave per-occurrence hook が engine に不存在** (certify 5点確認: HookName union/TRIGGERED_HOOKS に無し、char.ts removeAllSetAndStacked/removeOneSetCard・scene.ts toDeck/toHand は remove push のみで emit 無し)。a2 単体 (declared charSetCard $self + sceneRemove levelMax7) は実装可だが partial 出荷不可 (cluster方針) → カード全体 DEFER | `setcard:leave` hook 追加 (全 set-card クリア点で per-occurrence emit + ターン2 limit) の engine 拡張クラスタ。**同 hook が B02020 (大岡紅葉) a1 も解禁** (既存 a2-only 出荷・a1 DEFER 済の先例)。計3能力を unblock |

| 項目 | 内容 | 状況 |
|------|------|------|
| TSV 抽出の event/case category-drop (systemic) | cards-data の TSV は **event/case の `category1/2/3` (= 特徴) を全件 drop** している (event.tsv/case.tsv に features 列が無い)。一次 API `_raw/*.json` の `category` が特徴の正本。**実測 blast-radius (2026-06-15-2 triage, 決定論 audit)**: 実装済 event 76 / case 65 を API category と全件突合 → dropped-trait は **case 0件 / event 1件 (B06035 の YAIBA、既に hirameki fire-path 理由で DEFER 済)**。MVP deck (D08/D11) は手書きで API 以前のため対象外 (D08026=古城/D11021=婚活 正常)。**= 現出荷カードへの live 影響ほぼ 0**。systemic fix は future-proof のみ (per-card certify が新規実装時に捕捉、赤魔術 family が実証) | **低 urgency に格下げ**。必要なら TSV gen 側で category→traits/caseTraits を carry (全 event/case def に影響→smoke/挙動の広域確認が要る、別タスク) |
| charRemoveSetCard `n:N` の候補不足時 clamp | PA短縮形 pick の **強制ちょうど N 枚は `n:N` (number)**、`max:N` は 0..N。候補が N 未満のとき `n:N` は available 数へ clamp。さらに certify が **AI/CPU 経路 (resolve-picks Pattern A) は picked 1体のみ解決** し chain が reanimate/bonus へ進む点を指摘 (家族共通)。B07055 a1・**B07031 a2** が同構造 | HUMAN 経路 (apply-pick per-uid) と test (drain pickedUids) は計2枚で正。両カードとも非MVP=smoke/CPU 不在で live 影響なし。strict 化は engine backlog (公式 Q&A 未裁定) |
