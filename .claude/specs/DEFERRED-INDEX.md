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

## engine拡張 cluster16 (filter-predicate, 2026-06-16) — 出荷 11枚 + DEFER

cluster16 engine (cardNameNot + deckReveal filterAny、Commit1=2c0b492b) を使い 9 候補 certify → **6 reps + 5 clones = 11枚出荷**
(B03113/B03053/B06081/B03016/B04012/B07035 + clones)。**cluster15 で記録した cardName-EXCLUSION gate (下記 B06087/PR280) は
cluster16 G1 `cardNameNot` で解消済**。出荷 changelog: [2026-06-16-08](../changelog-entries/2026-06-16-08-cluster16-filter-predicate-ship.md)。

| rep | DEFER 理由 | 種別 |
|-----|-----------|------|
| ~~PR280 / B06087 / B06087P (萩原千速)~~ | ✅ **出荷済 (2026-06-18、`cards/wave2-cluster16-hagiwara-pair`)**。DEFER 3点を解消: (1) over-fire `triggerCondition` → `condition:and[fileAtLeast6, removedCharMatches{opp,contact-ap,self}]` で手 author、(2) a1 partnerColorKeyword __shared import、(3) 初の自己リムーブ observer 再入を専用 gate5 テスト `tests/cards/hagiwara-self-remove-observer.test.ts` (9 pass) + 敵対 Workflow (opus 4 lens pass / ship:true) で安全実証。changelog [2026-06-18-01](../changelog-entries/2026-06-18-01-hagiwara-self-remove-observer-ship.md) | ✅ 出荷済 |
| B09016 (円谷光彦) | 「**ミスリードしたとき**」反応 trigger が card-triggerable hook に無い (misread は内部 reasoning:before-add で同期処理、「自分が misread した」sign号無)。新 hook emit+register = engine change 必須 | yellow (engine gate) |
| B07051 (桃井恵子) | ~~sweep が B03016 clone に誤 grouping。実は別カード (怪盗キッド/高校生 reveal)~~ → **✅ 出荷済** (2026-06-18 セッション⑳、B03016 文字単位 twin、ALL_CARDS 1341→1342) | ✅ 出荷済 |

## engine拡張 cluster15 (removal-observer 反撃カード一族, 2026-06-16) DEFER 14 rep

28 rep certify のうち 14 rep を出荷 (verifiedOk green pure-JSON)、14 rep を DEFER。**反撃 ability 自体は全て green**
(cluster15 で解禁済)、他句が別 gate のため card 全体を保留。spec: [engine-cluster15-contact-removal-observer-design.md](engine-cluster15-contact-removal-observer-design.md)。

| rep | DEFER 理由 (反撃以外の句) | 種別 |
|-----|--------------------------|------|
| ~~B06038 B06039 B08010 B09071~~ | ✅ **出荷済 (2026-06-18、`cards/wave2-cluster15-partnercolor`)**。keyword-grant closure (partnerColorKeyword __shared / B08010 は絆 bond grant inline closure = B08012 鏡像) + removal-observer (bare `removedCharMatches{opp,contact-ap,self}`、cluster16 萩原で既出荷) を手 author。parallels 含め 8 printings (B06038/P, B06039/P, B08010, B09071/P/P2)。gate5 `tests/cards/cluster15-followup-removal-observer.test.ts` 10 pass (end-to-end contact gating decoy [cause/by/side] + effect/grant 1対1)。engine変更0 | ✅ 出荷済 |
| ~~B04004 / B04004P~~ | ✅ **出荷済 (2026-06-21、`cards/wave-dsl-reauthor`)**。a3 を `matcherCondition and[triggerCharMatches{side:opp,filter:{}}, triggerCharMatches{payloadKey:targetUid,side:self,filter:{cardName:工藤新一}}]` (actor+target AND gate、B01062/B08048) で再author。敵対verify 2/2 ship・decoy test 1対1。changelog 2026-06-21-01 | ✅ 出荷済 |
| B06087 | 登場候補の **cardName-EXCLUSION** filter (「萩原千速以外」) が TargetFilter に無い + chain/optional 構造 | refuted (engine gate) |
| B09022 | sceneSetState 自側限定 picked-sleep (short-form side hardcoded 'either' / explicit-$pick in chain no-op) | refuted (engine gate) |
| D02008 | action-scoped opponent cutin-ban (continuous aura のみ対応、on-action 不可) | yellow |
| B05009 | own-side enterSource (「自分のキャラの能力によって登場」の side qualifier 無) | yellow |
| B06068 | turn-scoped で **印字キーワード剥奪** (突撃[キャラ]を失う) の subtractive turnEffect 無 | yellow |
| B07063 | charGrantAbility で removal-observer ability 付与 (validate.ts が leave:to-remove grant を禁止) | yellow |
| PR136 | charSetCard の owner-deck-source (either 側 1 枚選択の持ち主デッキ) | yellow |
| PR280 | **cardName-EXCLUSION** candidate filter (「萩原千速以外」) | yellow |
| B05106 | MR (rules/18 能力①② 未配線、isMR は display-only) | yellow |

**新 gate 発見: cardName-EXCLUSION candidate filter** (B06087/PR280) — TargetFilter は positive inclusion のみ。将来の小 cluster 候補。

## 運用

- 新規 defer が発生したら本ファイルに追加 + 該当 BUG-XXX.md または spec doc に
  リンク
- 月次 cleanup phase で本リストを見て解消可能項目を洗い出す
- `.claude/auto/` の mapping/state docs と整合性確認は手動 (auto-gen 対象外)

## Task D engine拡張 wave#1 繰越 (2026-06-12, session log 2026-06-12.md)

| 項目 | 内容 | 解禁条件 |
|------|------|---------|
| mustGuard token | 「ガードできる場合、必ずガードする」(B09040 a2) | guard 強制の AI/UI 同時追従 (GuardPickerModal forced 化) |
| auraGrant (AP/LP buff) | **✅ 解消 (2026-06-15 cluster13)**: continuous OWNER-ONLY 制約を解除し、他キャラへの数値 aura (apDeltaAura/lpDeltaAura + auraFilter + auraExcludeSelf) を board-scan reader で実装。11 printings 出荷 | 完了 — branch engine/wave2-cluster13-aura-grant |
| auraGrant (triggered 付与) | 常時 aura で他キャラに **triggered 能力テキスト**を付与 (B09024 a1「他キャラに【現場リムーブ時】を与える」) | **別 gate 継続 DEFER**: 非キーワード能力テキストの付与 + 二重 queue 防止 (cluster13 の数値 aura とは別機構) |
| partner-area 構造 | ビッグジュエル B07045 / MR 列挙 B09047 / MR能力①② (rules/18) | GameState slot + UI (次 wave 最終段) |
| 「パートナーエリアでも宣言できる/発動する」句 | B07079/P・B08032/P・B09054/P (今回出荷分) + B07093/B05066 (前例) は句を vacuous 扱いで出荷 | partner-area キャラ slot 実装後に句を有効化 |
| name-designation | 「カード名を1つ指定し」UI+条件 (B09003/B09108/B09111/B09052) | 宣言 UI surface + designated-name 比較 condition |
| ~~multi-card sceneEnter~~ | **✅ 解消 (2026-06-15 cluster14)**: sceneEnter に cardIds:'$pick.cardIds' 契約 + switchRemoveUids[] (現場満杯 switch) を additive 拡張。distinctNames AI dedup + skipResolvesAtom (0枚でも後続 step 解決)。B09010/P + PR042/PR046 計 4 printings 出荷 | 完了 — branch engine/wave2-cluster14-multi-sceneenter。残 B01022 (multi-match deckRevealUntil) / B05117 (persistent set-granted leave ability) は別 gate |
| ~~nested filter dyn~~ | **✅ 解消 (2026-06-15 cluster12)**: pick query filter 内の {dyn} (levelMax 等) を substituteAtomPick chokepoint で解決。B08060 + 「小さくなった名探偵」family 15 printings 出荷。残 B05102/B09052 は **別 gate** (B05102=hirameki self-to-hand / B09052=rename verb + name-designation) のため対象外 | 完了 — branch engine/wave2-cluster12-nested-filter-dyn |
| until-N discard / reveal verb 等 | B07076/B07100/B08047 a2/B08093 a1 | 可変 count atom / hand-reveal verb |

## Task A green候補 wave#2 defer (2026-06-12, cards/wave2-handauthor)

| rep | 理由 | 解禁条件 / 備考 |
|-----|------|----------------|
| ~~B08020/P~~ | **✅ 再採用済 (2026-06-12 engine拡張 wave#2)**: BUG-132 GAP-1/2 修正 (chooseMatch decline channel + declaredBatch gate/遅延 pick) 後に hand-author で出荷。実機 decoy 検証済 (a1 色+kind filter / decline / a2 解決順+AP filter) | 完了 — branch engine/wave2-bug132 |
| ~~B07052~~ | **✅ 解決済 (2026-06-15 赤魔術 family)**: 「赤魔術 はどのカードにも無い」は **stale 誤認**。一次 API の `category1/2/3` (特徴の正本) に 赤魔術 が実在 (B07055/B07058 event, B07062 case)。TSV 抽出が event/case の category-trait を全件 drop していたのが真因 (field-drop, BUG-124 同族)。per-card で trait 補完 → B07052 実装 + B07062 latent 解消 | 完了 — branch cards/akamajutsu-trait (changelog 2026-06-15-04)。残課題は下記 known-gap |
| ~~B02026~~ | ✅ **出荷済 (2026-06-21、`cards/wave-dsl-reauthor`)**。a1 に空 `filter:{}` を付与 (eval.ts:298 が filter 存在時のみ scene 走査 → partner 除外、kind:character 不要)。敵対verify 2/2 ship・decoy 1対1。changelog 2026-06-21-01 | ✅ 出荷済 |
| B07104 | refuted(fatal): 【パートナー黒】を step1 のみ conditional 化 (全 ability gate が正) + PA pick 非終端 step で二重 grant desync | ability.condition 化 + PA ordering 対応 |
| B09038 | 🟢 **解禁 (BUG-111 #2 修正済)** — ~~refuted(fatal) ×2~~。a2 末尾の無条件 draw (「登場させ…セットし、カードを1枚引く」) が 0-enter human-decline で continuation [conditional,draw] ごと drop。draw を pick 前に reorder すると引いたカードが登場対象になり意味論非等価 → 不可 | BUG-111: 0-pick decline 時の必須末尾 step 保持 (engine) |
| ~~B09097 / B09097P~~ | ✅ **出荷済 (2026-06-21、`cards/wave-dsl-reauthor`)**。bare-chain `discard{max:1}`(min:0=decline可、shipped twin B04056/D08003 と同型) で再author。DEFER note の optional ラップは不要 (敵対verify が「AI-policy divergence only / 有益効果の greedy-accept 妥当」と nit-ship 判定)。decoy 1対1。changelog 2026-06-21-01 | ✅ 出荷済 |

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
| ~~B07098/P~~ | ~~「リムーブエリアにある【カットイン】を持つ【黒】のカード1枚につき AP+1000」の remove-area keyword-count dyn 不在~~ | ✅ **解禁** (2026-06-15 triage-greens batch): count-dyn ではなく `forEach over:{all, query:{area:'remove', filter:{keyword:'カットイン', color:'黒'}}}` で per-card AP+1000 (engine `target/candidates.ts:160` remove 列挙 + color/keyword filter + BUG-122)。runtime decoy test 44 assertions green |
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

## ✅ 赤魔術 trait family 残 (2026-06-15-2, cards/akamajutsu-family-2) — B07034/PR231 は cluster9 で解消済

family残 5枚を certify (opus adversarial)。3枚解禁 (B07031/B07038/B07047, ALL_CARDS 1171→1174)、2枚 DEFER。
**そのうち B07034 / PR231 は cluster9 (setcard:leave hook、下記) で解消** (ALL_CARDS 1174→1177、B02020 a1 も同時解禁)。

| rep | 理由 (支配 gate) | 状況 |
|-----|------------------|------|
| ~~B07034 / PR231 (小泉紅子, text 同一)~~ | a1「裏向きセットカードが1枚離れるたび引く」= set-card-leave per-occurrence hook が不在 | **✅ 解消 (cluster9, 2026-06-15)**: `setcard:leave` hook を additive 実装し B07034/B07034P/PR231 a1+a2 + B02020/B02020P a1 を出荷 |

## loseGame/defeat verb — landscape の「低リスク 3枚」は誤り (2026-06-15 cluster10 certify で判明)

cluster10 候補として triage landscape が「loseGame verb / low risk / 3枚 (B09107/D07024)」と分類したが、
**実テキストを読むと loseGame verb 単体では 0 枚解禁**。全「相手はゲームに敗北する」カードが重い別 gate を伴う:

| パターン | カード | 支配 gate (loseGame 以外) |
|---------|--------|--------------------------|
| 事件解決能力 書き換え型 | D07024 / B03135/P / B05118/P / B05119/P / B06105〜108/P (計14+) | **パートナーの【事件解決】能力を別能力に書き換える** (勝利条件ロジックに介入、high-risk) + 【証拠隠滅】alt-win keyword + 〚証拠を事件レベル数リムーブ〛cost |
| 証拠 reveal+trait-count 型 | B09107/P | 【事件解決】disable + 証拠 全 reveal verb + 証拠の特徴[犯人]≥8 count condition |

→ **loseGame は低リスク単発 verb ではなく high-risk multi-gate クラスタ**。landscape の未精読 gate の risk 評価は信用せず
per-card certify が必須 (card-wave skill 教訓)。loseGame verb 追加 + 上記いずれかの gate 群を別途設計するクラスタとして DEFER。

## ✅ cluster11 (enter-source-level filter) — BUG-146 と coupled で出荷 (2026-06-15, engine/wave2-cluster11-enter-source)

**解禁 4枚** B01014/B01015/B01021 (【登場時】レベル3以上のキャラ能力/イベント効果で登場した場合〜) + B07019
(【解決編】【緑】イベント効果で登場した場合〜)。ALL_CARDS 1177→1181。BUG-146 (効果登場の【登場時】不発火、enter emit
source 統一) を同コミットで coupled 修正 + 新 condition `enterSource` (4点同期: types union / eval case / CONDITION_KIND_MAP /
validate-specs CONDS)。opus 3-lens 敵対設計レビュー = 全 GO-with-fixes / 0 BLOCK。enter source consumer は
selfOnlyMatches + sourceBindings のみ・非selfOnly listener は PR117/PR118 のみ (payload.uid 読み、source 不読) = 水平展開 clean。
詳細は [BUG-146](../bugs/BUG-146.md) + changelog 2026-06-15-07 + cluster11-enter-source.test.ts (16本)。

### enterSource の既知制約 (カード defer ではない)

| 項目 | 内容 | 状況 |
|------|------|------|
| sourceFilter は CardDef-static 評価 | matchOneFilter c=null = **印字値** (level/ap/lp の continuous 修正は反映しない、原因カードが盤面を離れている可能性ありのため必然)。cluster11 4枚は level/kind/color のみ参照で実害なし | 文書化のみ。apMin/lpMin を sourceFilter で使う場合は注意 |
| 原因カードが partner/case | enterSource sourceFilter は明示 `kind:'character'/'event'` を持つため partner/case 原因の登場は不一致 (テスト済)。「キャラ/イベント」以外の原因は仕様上対象外 | 設計どおり |
| 手動登場 (hand-use/next-hint) に sourceCardId 無し | 2 atom emit のみ sourceCardId を運ぶ。enterSource{viaEffect:true} で手動登場は除外されるため整合 (cluster11 は効果登場専用) | 設計どおり |

<details><summary>(旧 block 記録、参考)</summary>

cluster11 候補 B01014/B01015/B01021 + B07019 を実装着手。新 condition `enterSource` を設計・**条件ロジックは diag で正と確認**したが、出荷は **block** だった:

- **BUG-146**: 効果/能力による登場 (sceneEnter/sceneSwitch atom) で entered char の【登場時】(selfOnly) が
  **engine 全体で不発火** (atom が enter emit の source を ctx.source=原因カードにしており selfOnly 不一致)。
  cluster11 のカードは全て「効果登場」を必須要件とするため、本 bug 未修正では【登場時】が永久不発 = カードが機能しない。
- landscape は「enter-source-level / low risk / 4枚」と分類したが、実体は **BUG-146 (高リスク広域 emit 修正) に依存**。
  cluster10 (loseGame) と同様、landscape の未精読 gate の risk 評価が過小評価だった (certify/diag 必須の再実証)。
- **解禁条件**: BUG-146 修正 (登場 emit の source を登場キャラに統一 + 原因カードは payload。全 enter listener 水平展開 +
  smoke 再 bless が要る専用クラスタ) + enterSource condition (3点同期) + 4枚 を **同時出荷** (coupled)。未 commit の
  cluster11 partial work は破棄済 (main クリーン)。設計詳細は BUG-146.md。

</details>

## ✅ engine拡張 wave#2 cluster9 (setcard:leave hook, 2026-06-15, cards/wave2-cluster9-setcard-leave) — known-gap

`setcard:leave` per-occurrence hook を additive 実装 (HookName union + TRIGGERED_HOOKS + scene.ts removeToRemove/toDeck/toHand emit-before-splice + char.ts removeOneSetCard emit + taskA whitelist)。
**5枚解禁** (B07034/B07034P/PR231 a1+a2 + B02020/B02020P a1)。opus 3-lens 敵対設計レビュー = GO / 0 blockers。

| 項目 | 内容 | 状況 |
|------|------|------|
| FIX-3 「裏向き」filter (B07034 a1) | text は「裏向きでセットされているカード」だが DSL に faceUp filter 無し。全 charSetCard atom が faceUp:false = face-up set card は現状 0 枚のため **vacuously 等価**。payload は faceUp を運ぶ (将来 matcherCondition 1 行で追加可・engine 変更不要) | 低 urgency。face-up set card 追加時に B07034 a1 へ faceUp filter 追加 |
| FIX-2 cross-char 同時離場の順序依存 | engine は atomic な複数キャラ同時リムーブを持たず逐次 removeToRemove。listener (このキャラ) が sibling より **先に** splice されると sibling の set card 離場では発火しない (self-leave 単体 / 1キャラ複数 set card は正)。leave:to-remove と同じ engine-wide 性質 (公式Q&A「同時に離れた場合も発動」を厳密充足するには batch-aware removal API = 骨格解凍が必要) | 文書化のみ (engine-wide 既知制約)。batch-aware removal は不要不急 |
| FIX-4 selfToDeckBottom コスト経路 | scene.toDeckBottom (変装 carry-over 用 + selfToDeckBottom コスト用の dual-use) には setcard:leave emit を意図的に付けない。selfToDeckBottom は真の離場だが、現状 selfToDeckBottom コスト 14枚に charSetCard 併用カードは 0 で実害なし。また toDeckBottom は set card 自体を清掃しない (pre-existing orphan、本変更とは独立) | 低 urgency。selfToDeckBottom コスト × set card 保持カードが将来出たら emit 追加 |
| FIX-8 stacked-under 離場 (rules/16「別のキャラの下に重なる」) | 既存キャラ (set card 保持) を別キャラの下に重ねる engine path が無い (charStackCard は remove/hand/deck からのみ) ため unreachable | out of scope (path 不在) |

| 項目 | 内容 | 状況 |
|------|------|------|
| TSV 抽出の event/case category-drop (systemic) | cards-data の TSV は **event/case の `category1/2/3` (= 特徴) を全件 drop** している (event.tsv/case.tsv に features 列が無い)。一次 API `_raw/*.json` の `category` が特徴の正本。**実測 blast-radius (2026-06-15-2 triage, 決定論 audit)**: 実装済 event 76 / case 65 を API category と全件突合 → dropped-trait は **case 0件 / event 1件 (B06035 の YAIBA、既に hirameki fire-path 理由で DEFER 済)**。MVP deck (D08/D11) は手書きで API 以前のため対象外 (D08026=古城/D11021=婚活 正常)。**= 現出荷カードへの live 影響ほぼ 0**。systemic fix は future-proof のみ (per-card certify が新規実装時に捕捉、赤魔術 family が実証) | **低 urgency に格下げ**。必要なら TSV gen 側で category→traits/caseTraits を carry (全 event/case def に影響→smoke/挙動の広域確認が要る、別タスク) |
| charRemoveSetCard `n:N` の候補不足時 clamp | PA短縮形 pick の **強制ちょうど N 枚は `n:N` (number)**、`max:N` は 0..N。候補が N 未満のとき `n:N` は available 数へ clamp。さらに certify が **AI/CPU 経路 (resolve-picks Pattern A) は picked 1体のみ解決** し chain が reanimate/bonus へ進む点を指摘 (家族共通)。B07055 a1・**B07031 a2** が同構造 | HUMAN 経路 (apply-pick per-uid) と test (drain pickedUids) は計2枚で正。両カードとも非MVP=smoke/CPU 不在で live 影響なし。strict 化は engine backlog (公式 Q&A 未裁定) |

## ✅ cluster12 (nested-filter-dyn) — FILE枚数以下レベルの登場 15枚 出荷 (2026-06-15, engine/wave2-cluster12-nested-filter-dyn)

triage workflow で 6 gate を実証選定 → 最有力 `nested-filter-dyn` を出荷。`resolve-picks.substituteAtomPick` の
`targetCandidates` 列挙直前で pick query `filter` 内の `{dyn}` (levelMax 等) を `evalDyn` で解決 (新ヘルパー
`resolveTargetFilterDyn`、frozen def は clone して非破壊、dyn 不在は同一参照=no-op)。型 widen せず chokepoint 解決。
**15 printings 解禁** (ALL_CARDS 1181→1196): 「小さくなった名探偵」family 13 + B08060/P。opus 3-lens 敵対設計レビュー GO。
詳細: changelog 2026-06-15-08 + cluster12-nested-filter-dyn.test.ts (8本)。

| 項目 | 内容 | 状況 |
|------|------|------|
| dispatch 後 filter の未解決 {dyn} | sceneEnter は確定 cardId で登場し再 filter しないため inert (列挙のみ cap 適用) | 文書化のみ |
| deck-look predicate の dyn | 本 family の reveal filter は color/kind のみ (levelMax dyn は sceneEnter 側) のため `targetFilterToPredicate` 非該当 | 設計どおり |
| apMin/apMax/lpMin/lpMax filter の dyn / filterAny+{dyn} | resolveTargetFilterDyn は filter / filterAny 両形の全 {dyn} 数値フィールドを汎用解決 (敵対レビュー指摘の filterAny latent gap も hardening 済)。現出荷は filter.levelMax のみ使用 | future-proof |

## ✅ cluster13 (aura-grant) — 他キャラへの AP buff aura 11枚 出荷 (2026-06-15, engine/wave2-cluster13-aura-grant)

continuous の OWNER-ONLY 制約を解除し「【自分ターン中】自分の現場の [filter] キャラを AP＋1000」型を実装。
`ContinuousModifier` に apDeltaAura/lpDeltaAura/auraFilter/auraExcludeSelf を additive 追加 + `read/char.auraDelta`
board-scan reader + `candidates.auraDeltaSafe` (再帰 guard) を ap/lp/matchOneFilter の両方に合算 (filter-AP=combat-AP)。
**11 printings** (ALL_CARDS 1196→1207): D05005/D07010/D07011/B01038/B01038P/B03075/B07044 (単純aura+hirameki) +
B02012 (levelMax5 aura+action draw) + B09009 (trait aura+hirameki回収) + PR274/PR275 (conditional aura+宣言remove)。
opus 3-lens 敵対設計レビュー GO。詳細: changelog 2026-06-15-09 + cluster13-aura-grant.test.ts (9本)。

| 項目 | 内容 | 状況 |
|------|------|------|
| 両 side aura | auraDelta は target の同一 side のみ走査 (自陣 buff 専用)。現出荷 11枚は全て「自分の現場」aura のため十分 | 設計どおり (相手 buff/debuff aura が出たら ownerSide 走査を拡張) |
| triggered 能力テキスト付与 aura | B09024「他キャラに【現場リムーブ時】を与える」は非キーワード能力テキスト付与 = 別 gate | 継続 DEFER (上表 auraGrant(triggered 付与)) |
| auraFilter の AP/LP filter | auraFilter が apMin/apMax 等を使う場合、matchOneFilter 再入は _inAuraDelta で aura 抜き AP を見る (二重計上防止)。現出荷は color/trait/level のみ使用 | 文書化のみ |

## トリアージ・スイープ window4 certify — yellow/refuted DEFER (2026-06-16, batch#3)

window4 残 8 rep を per-card certify (opus grounding→敵対 verify)。green 2 / 敵対 verify 通過 (verified) 1。
**出荷 = B03079 (+ B03079P clone) のみ**。残 7 は全て既知 STILL-OPEN gate で DEFER (再選定防止)。

| rep | 理由 (支配 gate) | 解禁条件 |
|------|------|------|
| B03056 | **refuted(fatal)**: a2 が `conditional{if: sceneHas(探偵 sleep nMin:3), then: optional{...}}` 構造。engine の resolveEffectPicks walk が conditional.if 評価**前**に optional を human へ eager surface し、resume 時に conditional ラッパを落とすため、3枚未満でも証拠獲得+自己リムーブが発火 (敵対 verifier が実証: evidence 0→1, self removed, cond false)。**新規 gate: conditional-gated-optional surfacing**。a1 (登場時 deck-look) は green | optional surface の conditional 再ゲート (engine) or 条件を ability.condition / optional 自身の gate へ再構成 |
| B08033 | yellow: ability2 のコスト「現場のキャラにセットされた裏向きカードを合わせて2枚リムーブ」= **set-card-removal COST kind 不在** (Cost union に該当なし、charRemoveSetCard は EFFECT verb のみ)。effect 化は意味論違反 (canPay gate 喪失)。a1 (登場時 set) は green | 新 Cost kind `removeSetCardFromScene{n}` を cost/evaluate+pay へ配線 (engine) |
| B05027 | yellow: **MR partner-area structure** gate。ability2「この能力はパートナーエリアでも発動する」= 40枚デッキ MR が partner-area 常駐する GameState slot 不在 (collectCardsInPlay は scene+本体partnerのみ列挙)。MR能力①② (rules/18) も未配線 | partner-area card slot + MR enumeration (XL) |
| B01057 | yellow: event-self-set (charSetCard は fromDeckTop のみ) + **set-card→host triggered 能力付与** gate + 付与する【現場リムーブ時】が granted-ability validator 棄却 (handleLeaveToRemoveSelf は turnEffects.grantedAbilities 非走査) | set-card→host 能力付与機構 (engine) |
| B02031 | yellow: event-self-set + **set-card→host へ 突撃[キャラ]+action-target拡張の継続付与** gate (read/char は set card を ability/keyword 付与源に読まない) | set-card→host 付与 + action-eligibility 拡張 |
| PR263 | yellow: **partner-area structure** gate (ビッグジュエル列挙)。PartnerOnBoard に追加 partner-area card slot 無 / candidates partner-area 枝は partner 1体のみ / `$self.partnerAreaTrait` dyn 不在 (per-card AP scaling 不可) | partner-area slot + candidate 列挙 + trait-count dyn (XL) |
| PR099 | yellow: ability2「キャラのカード名を1つ指定し…カード名を書き換えてもよい」= **name-designation** gate (指定 UI/condition 不在) + **card-name rewrite** verb 不在 (names() は def 静的のみ)。a1 + AP+1000 半分は green | name-designation UI + card-name override verb (XL) |

## トリアージ・スイープ window5 certify — refuted/gate5-defer/yellow DEFER (2026-06-16, batch#4)

window5 = fresh green候補 20 rep を per-card certify (opus grounding→敵対 verify)。green 13 / 敵対 verify 通過 11。
**gate5 実機 decoy テストで B05028 が BUG-111 を踏み追加 DEFER → 出荷 = 10 verified-green (+10 byte同一 clone) = 20枚** (ALL_CARDS 1277→1297)。

> **🟢 解決 (2026-06-16, BUG-111 #2 根本修正)**: 上記 DEFER の BUG-111 系を engine 修正 + opus 敵対レビューで決着
> ([BUG-111.md](../bugs/BUG-111.md) / [bug-111-human-decline-fix-design.md](bug-111-human-decline-fix-design.md))。
> - **B05028 = 誤診断**: chain over-fire は再現せず (5 シナリオ独立検証)。**修正不要で出荷可能** → 解禁。
> - **B09038 = 修正で解禁**: sequence mandatory-tail (draw) の human-decline drop を修正。→ 解禁。
> - **B09056 = DEFER 継続**: 実バグ (sequence under-fire) は修正済だが、末尾が 2択 `choice` で choice-in-continuation の
>   eager-surface (BUG-145 系) が fragile。choice surface 整備は別 engine 課題のため保留。
> 解禁 2 枚 (B05028/B09038) は後続バッチで card-wave 出荷。
出荷 = B01065/B02038/B03031/B05024/B07041/B01076/B02041/B04051/B07057/PR237 (+各 P/clone)。残 (refuted 2 + gate5-defer 1 + yellow 7) は下記 (再選定防止)。

| rep | 種別 | 理由 (支配 gate) | 解禁条件 |
|------|------|------|------|
| B05028 | 🟢 **解禁 (誤診断、上記解決参照)** | ~~宣言a1 chain[charRemoveSetCard, sceneRemove] の「そうした場合」が human-decline 経路で破綻。~~ (2026-06-16: 再現せず誤診断と判明、修正不要で出荷可能)set-card holder 在 + step1 を 0枚 decline すると step2 sceneRemove が**発火してしまう** (applyPickSkipAndContinuation が chain 残りを無条件実行、decline した charRemoveSetCard が `__chainStepNoApply` を立てない)。no-candidate 経路は substituteAtomPick で正しく break するが **candidate在+decline** が壊れる。AI は greedy で decline せず仮面化 → certify+敵対verify 見落とし、**gate5 実機テストが検出** | BUG-111: candidate在 pick の human-decline でも chain-gated continuation を drop (engine) |
| B09056 | DEFER 継続 (choice-surface gap、BUG-111 underfire は修正済) | optional{sequence[自sleep, sceneRemove(0-pick), **必須choice**]}。レベル8以下 removal 候補在 + 0枚 decline で末尾の必須 choice (痕跡分岐: 黒復活/相手mill) が drop。「リムーブし、以下から1つ選んで行う」= choice は常時発火が正 | 同上 (BUG-111) |
| B04042 | yellow | 「レベルの合計が10以下になるようにキャラを2枚まで選び」= multi-pick の**集約(sum/budget)制約**。engine に sum 制約 pick 機構なし (per-candidate filter のみ、distinctNames 以外の cross-selection 制約不可) | aggregate-selection-budget 制約 (engine) |
| B06032 | yellow | 【ヒラメキ】本体が top-level optional{chain[discard1, sceneEnter from:remove]} を要するが、hiramekiResolve 経路が humanChooser なしで resolveEffectPicks を呼ぶため top-level optional が常に skip → 再生効果が無音 no-op (BUG-145 同族) | hirameki 経路の top-level optional honor (engine) |
| B08038 | yellow | 「この効果によって特徴[高校生]/[鈴木財閥]がリムーブされた場合」= **removed-by-this-effect** 条件。mill verb は bind せず、removeTraitAtLeast は remove パイル累積を見るため中盤で誤発火 (false-positive AP+1000) | mill bind + removed-by-this-effect condition (engine) |
| ~~PR236~~ | ✅ 出荷済 | **出荷済 (2026-06-21、`cards/wave-distinct-name-count`)**。`sceneHas` eval を `query.distinctNames` honor に拡張 (1分岐 additive、新 Condition kind 無)。PR236/PR242 (大和敢助 declared a2 宣言ゲート) + B08067/B08067P (諸伏高明 enter conditional) 計 **4 刷**。詳細下記「distinct-name-count cluster」 | — |
| B03033 | yellow | 「相手の現場のセット済キャラを AP-1000」= **相手側の数値 aura**。cluster13 aura は target 同 side (自陣) のみ走査。相手 side 数値 aura 機構なし | cross-side numeric aura (engine) |
| B06033 | yellow (hirameki verb 解禁・別 gate で DEFER 継続) | ヒラメキ「このカードを手札に加える」= evidence-self→hand は 2026-06-21 解禁 (`handAddFromRemove fromSelf`、下記 cluster)。**残 gate**: a1 = `sequence[chain[evidenceToHand{pick}, handToEvidence], sceneEnter{YAIBA}]`。公式Q&A が swap→enter 順を強制 (swap で手札に来た札を enter 候補化) → chain を sequence 末尾に移せず、evidenceToHand の pick pause で **chain continuation を親 sequence が上書き** (BUG-111 family、1:1 continuation の nest 非対応) → handToEvidence 脱落。decoy §8 検出 | continuation-nest (sequence[chain[pausing-pick], step2] の継続上書き、engine) |
| B08050 | yellow | 「【解決編】このキャラをレベル+3」= **継続 condition-gated self level 修飾**。ContinuousModifier は ap/lpDelta のみで levelDelta 不在 | continuous level modifier (engine、未着手 micro-cluster) |

## ✅ distinct-name-count cluster (sceneHas distinctNames 計数, 2026-06-21, cards/wave-distinct-name-count)

standing green queue 枯渇 + engine変更0 残弾尽きを決定論スキャン (`.tmp/gate-yield-scan.cjs`、未実装 685 cardNum を
実テキスト走査) で確証 → 最クリーンな単一 additive gate **distinct-name-count** を engine拡張 micro-cluster 化。
`src/engine/cond/eval.ts` の `sceneHas` case に `query.distinctNames` honor 分岐 1 つ追加 (新 Condition kind 無、
既存 flag を計数経路でも honor)。**回帰ゼロ**: sceneHas 内で distinctNames を使う既存カード 0 (D08021/B09010 は pick 内のみ)、
smoke baseline 不変。**4 刷出荷** (ALL_CARDS 1362→1366): B08067/B08067P (諸伏高明 enter conditional) + PR236/PR242
(大和敢助 declared a2 宣言ゲート)。decoy 10 pass (§2 同名 dedupe 1対1 witness) + 敵対verify opus OVERALL SHIP/refute0。
changelog [2026-06-21-02](../changelog-entries/2026-06-21-02-cluster-distinct-name-count.md)。

| rep | DEFER 理由 (残存 gate) | 解禁条件 |
|-----|----------------------|---------|
| B08063 (黒田兵衛) | a1「現場にいるこのキャラは〚特徴［長野県警］〛を持つ」= **self-trait-grant continuous** が engine 不在 (ContinuousModifier は ap/lpDelta/grantKeywords のみ、trait 付与機構なし)。a2 は distinct-name-count で解禁済だが partial 出荷せず | self-trait-grant (継続 trait 付与) 機構の追加 (別 micro-cluster) |

### 同セッションで scope した未着手 micro-cluster (engine変更0 枯渇後の次弾候補、要別判断)

| gate | 対象 (実未実装) | engine 追加内容 |
|------|----------------|----------------|
| ~~handToEvidence~~ | ✅ 一部出荷 (B06029/B06029P)。下記「handToEvidence cluster」 | `handToEvidence` verb 1つ (evidence→hand は `evidenceToHand` 既存)。clean yield は **1 base のみ** (B03077/B06033/B06016 は各々別 engine 変更で DEFER) |
| ~~evidence-top→hand (fromTop)~~ | ✅ 出荷済 (B03077)。下記「evidence-top→hand cluster」 | `evidenceToHand` に `fromTop` flag 1つ。clean yield = **1 base のみ** (この族で「上から」型は B03077 単独) |
| continuous levelDelta | PR264 (clean) / B08059 (条件付) ほか | ContinuousModifier.levelDelta + 全 level-read site honor (effort 大・yield 小)。B08050/B09003/B04046 は二次 gate で別途 |

## ✅ evidence-self→hand cluster (handAddFromRemove fromSelf フラグ, 2026-06-21, cards/wave-evidence-self-to-hand)

【ヒラメキ】「このカードを手札に加える」族。証拠から action[事件] でリムーブされる**そのカード自身**を手札へ戻す。
`src/engine/effect/atom-handlers.ts` の `case 'handAddFromRemove'` に **`fromSelf` 分岐 1 つ**追加 (新 verb なし、
`args:unknown` ゆえ型/whitelist 同期不要)。`fromSelf===true` で pick をスキップし `ctx.source.cardId`
(=リムーブされた証拠カード自身、`handleEvidenceRemovedHook` が source 起動 + `removeTop` が remove 末尾に push 済)
を `lastIndexOf` で remove から取り手札へ。a2 DSL = `triggered{evidence:remove-by-action, optional}` +
`atom handAddFromRemove{player:'self', fromSelf:true}`。**出荷 PR085/PR091** (沖矢昴、赤L4、cardId 0481 の絵柄違い
2刷、ALL_CARDS 1369→1371)。a1 = 登場時キャラ1枚まで pick→ターン終了まで〚ブレット〛付与 (charGrantKeyword{$pick,turn}、
exemplar D02013/B03005)。decoy 8 pass (§4 e2e: removeOpponentEvidenceTop→removeTop→pendingHirameki→resolve 一気通貫 /
§2 lastIndexOf 同cardId複数 / §5 ブレット honor)。changelog
[2026-06-21-05](../changelog-entries/2026-06-21-05-wave-evidence-self-to-hand.md)。

| rep | DEFER 理由 (残存 gate) | 解禁条件 |
|-----|----------------------|---------|
| B06033 / B06033P | hirameki verb は本 cluster で解禁済。残 gate = a1 `sequence[chain[evidenceToHand{pick}, handToEvidence], sceneEnter{YAIBA}]` で evidenceToHand の pick pause 時に chain continuation を親 sequence が上書き (BUG-111 family、1:1 continuation nest 非対応) → handToEvidence 脱落。公式Q&A が swap→enter 順を強制し chain を末尾に移せない。decoy §8 検出 | continuation-nest (sequence[chain[pausing-pick], step2] 継続上書き、engine) |
| B02013/P · B05041/P | event「キャラにセットする」+ host への継続付与 (突撃 grant / triple-protection)。set-event + host-continuous 機構が engine 不在 | set-event host-continuous (engine) |
| ~~B05102~~ | ✅ **出荷済** (2026-06-21、下記「turn-scope levelDelta wave」)。誤 DEFER だった: 「**ターン終了まで**レベル-1」= turn-scope one-shot = 既存 `charModifyLevel{scope:'turn'}` で実装可能 (continuous condition-gated levelDelta = B08050 とは別物)。engine変更0 | — |
| B03088/P | 【宣言】4名 bond gate (降谷零&諸伏景光&伊達航&萩原研二) + pick 1キャラに activate+AP+突撃 の **multi-atom-single-pick** + draw。多 atom を同一 pick に適用する carrier 検証が別途必要 | multi-atom-single-pick carrier 検証 (要確認) |

## ✅ turn-scope levelDelta wave (誤 DEFER 是正、engine変更0、2026-06-21、cards/wave-turn-leveldown-b05102)

上記 evidence-self cluster 表で「continuous (temp) levelDelta が不在」を理由に DEFER していた **B05102** が、
実は **既存 `charModifyLevel{scope:'turn'}` で実装可能** (engine変更0) と判明 → 解禁・出荷。DEFER note が
「**ターン終了まで**レベル-1」(turn-scope one-shot、turn end に `lvlMod_turn` を delete=BUG-119) を、毎 read
再評価する **condition-gated continuous levelDelta** (B08050「【解決編】レベル+3」= 真の engine gap) と
混同していた誤診断。決定論 scan (`ターン終了(時)?までレベル[＋－]\d`) で 3 候補抽出 → B05102 のみ clean。
**出荷 B05102** (小五郎の弟子、黄 L1 event、P変種なし、ALL_CARDS 1371→1372)。a1 = event-use + 【パートナー黄】
gate + `sequence[charModifyLevel{opp,turn,-1}, draw, sceneEnter{hand,黄,levelMax:fileCount}]` (BUG-111#2 で
sequence-mandatory-tail 解禁済、相手0/decline でも draw 発火)。a2 = ヒラメキ self→hand (前 wave fromSelf)。
decoy 12 pass (§2 mandatory-tail 境界=不在 / §3 level-down / §4 sceneEnter filter / §5 hirameki) +
smoke baseline 不変。changelog [2026-06-21-06](../changelog-entries/2026-06-21-06-wave-turn-leveldown.md)。

| rep | DEFER 理由 (残存 gate) | 解禁条件 |
|-----|----------------------|---------|
| B09078 | a1【事件編】【登場時】= deck-look 3 → **【白】か【黄】キャラ1枚まで + イベント1枚まで** (1 reveal から2種の dual-filter pick) + 残りをリムーブエリアへ (reveal-to-remove) + 「2枚加えた場合 手札1枚リムーブ」。a2 (turn-scope levelDelta) は解禁可だが card 単位は a1 gap で DEFER | dual-filter deck-look + reveal-to-remove (engine) |
| PR096 | a1 (enter-observer 喫茶ポアロ + turn-scope levelDelta) は解禁可だが、a2 =【宣言】cost[sleep + デッキ上5リムーブ] +「**コストによって特徴[探偵]のキャラがリムーブされた場合**」レベル8以下リムーブ = cost-mill 結果を参照する conditional が engine 不在 | cost-mill-result 参照 conditional (engine) |

## ✅ evidence-top→hand cluster (evidenceToHand fromTop フラグ, 2026-06-21, cards/wave-evidence-top-to-hand)

前 wave (handToEvidence) の DEFER 残 B03077 を解禁。「自分の証拠を**上から**1つ手札に加えてもよい。そうした場合、
手札からカードを1枚裏向きで証拠として得る」= evidence-**top**→hand。`src/engine/effect/atom-handlers.ts` の
`case 'evidenceToHand'` に **`fromTop` 分岐 1 つ**追加 (新 verb なし、`args:unknown` ゆえ型変更も同期も不要)。
`fromTop===true` で pick をスキップし証拠最上 (末尾、`removeTop` と整合) を手動 pop + `hand.add`。証拠0 なら
`__chainStepNoApply` で chain break (`filePopToHand` 同型)。a1 DSL = `optional{chain[evidenceToHand{fromTop:true},
handToEvidence{n:1}]}` (exemplar D09010 a1)。`optional`=してもよい (fromTop は deterministic ゆえ pick-0 decline 不可 →
optional が唯一の decline 経路)、`chain`=そうした場合、step2=得る(必須)。**出荷 B03077** (水無怜奈、赤L4、ALL_CARDS
1368→1369、P変種なし)。decoy 8 pass (§1「上から=末尾」を E_BOTTOM/E_TOP 両端 decoy で 1対1 witness) +
敵対verify opus OVERALL SHIP/9点ok/refute0。changelog
[2026-06-21-04](../changelog-entries/2026-06-21-04-wave-evidence-top-to-hand.md)。

## ✅ handToEvidence cluster (手札→裏向き証拠 verb, 2026-06-21, cards/wave-hand-to-evidence)

「証拠を1つ選び手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る」(evidence⇔hand swap)。
`evidence→hand` は既存 `evidenceToHand` で充足 → **新 verb は `handToEvidence` 1つのみ** (NEXT-SESSION の「2 verb」は誤り)。
`src/engine/effect/atom-handlers.ts` に PB pick (defaultArea 'hand') handler 追加 + union/ATOM_PICK_SPEC/validate/cjs の 4点同期。
手札在庫ガード (target が手札に無ければ no-op、証拠を湧かせない) + faceUp 既定 false + push=証拠1番上 (公式Q&A B06029)。
**chain semantics** = `chain[evidenceToHand max:1, handToEvidence n:1]` (exemplar D08003)。step1 が no-op (証拠0 / 0枚 decline)
なら step2 skip = 「そうした場合」。出荷 **B06029/B06029P** (ヘビ男、ALL_CARDS 1366→1368)。decoy 12 pass +
敵対verify opus OVERALL SHIP/refute0 (human-decline/AI/no-candidate 3経路の chain break を engine path で確証)。
changelog [2026-06-21-03](../changelog-entries/2026-06-21-03-wave-hand-to-evidence.md)。

| rep | DEFER 理由 (残存 gate) | 解禁条件 |
|-----|----------------------|---------|
| ~~B03077~~ | ✅ **出荷済** (2026-06-21、下記「evidence-top→hand cluster」)。`evidenceToHand` に `fromTop` flag 追加で解禁 | — |
| B06033 | a1 evidence-swap は解禁済だが、event + ヒラメキ「このカードを手札に加える」= **evidence-self→hand** verb 不在 + 「YAIBA緑lv6以下を登場」は既存 sceneEnter で可。card 単位は hirameki gate で DEFER | evidence-self→hand verb (hirameki redirect) |
| B06016 | 【宣言】【スリープ】 cost + swap は解禁済だが、別の【登場時】「デッキ上から3枚リムーブしてもよい。そうした場合…」= **deck-mill-gated chain** (pick-gate でなく mill-gate) が engine 不在 | deck-mill 実効果判定の chain-gate (engine) |

出荷 = B05078/B05078P (世良真純) + B03056/B03056P (千間降代) (changelog [2026-06-19-02](../changelog-entries/2026-06-19-02-wave-decklook-bottom.md))。
sweep landscape の「hand→deck-bottom verb 無」note は **stale** (wave1 で `deckToBottomBound`+`deckRevealUntil{maxN,upTo}` 追加済 = この族は engine変更0)。残 rep:

| rep | 種別 | 理由 (支配 gate) | 解禁条件 |
|------|------|------|------|
| B03042 | DEFER | look-5 で **探偵 2枚 (相対色「同じ色を持たない」) を同時 pick** + 「**シャッフル**してデッキ下」。deckRevealUntil は 1 match のみ / cross-pick 相対色 filter なし / shuffle-to-bottom variant 不在 | multi-match relative-filter pick + shuffle-bottom variant (engine) |
| PR265 | DEFER | 登場時「加えたカードの**レベル分**デッキ上からリムーブ」= bound カードの level を動的 N とする mill。deckRemoveTop は静的 N のみ + 解決編宣言 mill-by-level | dynamic-count (bound-card-level) mill (engine) |
| ~~B07066~~ | **出荷済** (㉖) | enter-observer remove (B04017同型) + 宣言 sleepChar cost→look-3 (B05078同型)。engine変更0 | — |
| ~~PR194~~ | **出荷済** (㉖) | 宣言 removeFromScene{self} cost→look-2 forced-top (filter省略=match-all、B01048同型)。engine変更0 | — |
| B08075 | DEFER | event「以下から**3つまで選んで行う** (上から順)」。bare `sequence[opt1,opt2,opt3]` 化は **opt3 (look-4→残りデッキ下) が 0-take でも deck並べ替え副作用 → unskippable (fatal)**。正しい model = sequence-of-`optional` だが (a) subset-of-options 前例なし (b) CPU 全 skip=完全no-op (c) optional+pick 合成 B09056系 fragility | multi-select-options engine 機構 or optional+pick 合成検証 |

> 補足 (再選定防止): named-next の **contact-removal-by-self 族は B04004/B04004P も 2026-06-21 出荷済** (a3 actor+target gate を
> matcherCondition で再author、上表参照)。残 4 (B09022/B05009/B06068/PR136) は contact trigger 以外の gate
> (chain-pick resolve / own-side enterSource / 突撃swap剥奪 / deck-set verb) で blocked。詳細は session log 2026-06-19 / 2026-06-21。
