# M3 未登録14 ID triage (2026-07-10, sonnet5)

対象: B06037/B07001/B08002/B08019/B08046/B07030/B08093/B09109/B09110/B07049/B09039/B09055/B07061/B09027。
全件 `.tmp/_ground/<ID>.md` dossier + 現行 src/engine 直読で再検証。capability snapshot (`_capabilities.md`)
は **stale (両方向)** — `sceneHas`/`handAtMost`/`apAtLeast`/`costRemovedMatches` 等が 41 件リストに未掲載でも
実装済(cond/eval.ts 直読で確認)。逆に一部 DEFER note の gap claim も stale (下記個別に明記)。

## 集計
GREEN=0 / UI_UNLOCKED=3 / SMALL_GAP=11 / BLOCKED=0

---

## UI_UNLOCKED (3件) — DSL 本体は全句 GREEN、PA宣言19 UI batch (enumDeclaredAbilitySources
partnerMR source / PartnerArea MR tile / flows resolve `partnerMR:`) が唯一の gate。
UI infra は現状**未着手** (grep 0件: enumerators.ts/PartnerArea.tsx/flows.ts に partnerAreaMR 無し、
flows.ts:260 コメントで自認)。engine 側 (declared-ability.ts:145-147 scope gate, triggered.ts:183-184
sentinel) は shipped 済 — author 時 `scope:'always'` 指定のみで良い。

- **B06037** 服部平次＆沖田総司 — a1 `enter+trait[高校生]+apMax8000→sceneRemove` GREEN。a2
  `charModifyAP(turn)+charSetTurnEffect{actionTargetsActive}` は B08037/B07090 exemplar 型で GREEN。
  旧 DEFER「scope on-scene では PA 不可」は engine 側は解決済 (要 `scope:'always'`)、残は UI のみ。
- **B08046** 赤井秀一＆ジョディ・スターリング — a1 `【FBI】2枚以上` = `sceneHas{nMin:2}` (cond/eval.ts:132)
  GREEN。a2 `costRemovedMatches{filter:{levelMin:8},key:'removeFromHand'}` (cost/pay.ts:105,
  cond/eval.ts:337) が attribution mini-wave 2026-07-10 で shipped 済 — **dossier DEFER は stale**。
- **B08093** 灰原哀＆シェリー — a1 cost filter `keyword:'現場リムーブ時'` は
  `ICON_KEYWORD_PREDICATES.現場リムーブ時=abilityIsSceneRemoveTrigger` (read/keyword.ts:92) で既に
  registered、`color:['青','黒']` は array any-match (candidates.ts:443-444) — **dossier DEFER
  「ability-presence filter 不在」は stale**。a2/a3 は 87 ファイルで shipped 済の【相手ターン中】
  【現場リムーブ時】+ `handAtMost` idiom / 2連 charModifyAP。

---

## SMALL_GAP (11件)

- **B07001** 毛利蘭＆灰原哀 — a1「コストで除去した[少年探偵団]/[毛利探偵事務所]カード**1枚につき**
  AP+1000」= cost-removed **count**(filter一致数) dyn が不在 (`$cost.removeDeckTop.ids` はあるが
  filter-match件数を返す dyn 演算子が無い、dyn/eval.ts resolveCost 単純drillDownのみ)。
  → 追加: dyn/eval.ts に `$cost.<key>.matchCount`(filter埋め込み) 演算子。〚突撃〛付与は無条件
  (Q&A確認済) で GREEN。a2 は B07090 型 GREEN。旧 DEFER「charGrantAbility が inert」は
  誤帰属 (実装は charSetTurnEffect 経由で機能済、charGrantAbility は無関係)。
- **B08002** 江戸川コナン＆灰原哀 — a1「リムーブしたキャラの**レベルと同じ枚数** mill」= 除去時点の
  level を静的 snapshot する root が不在 (dyn/eval.ts:541-547 `$bound.<key>.level` は
  `charRead.level(state,uid)` で**盤面を都度re-read**、除去済キャラは findChar 失敗)。
  → 追加: `$discarded.level` (dyn/eval.ts:20) と同型の `$removed.level` root。a2 `charStackCard`
  cardIds契約 (remove-source + 別 host pick) は D08021 型で GREEN。
- **B08019** 大岡紅葉＆伊織無我 — 既存 grounding (`.claude/specs/grounding/B08019.md`) が確定済:
  `perSideMax`(atom-pick-spec.ts:119-120) は engine 実装済だが、SceneArea が cross-side multi-pick
  収集を持たず単発 dispatch に collapse (BUG-165 cluster、B02033/B07031/B07055 と同型)。
  → 追加: SceneArea 側 multi-select 収集 (UI 層、T2)。旧 scope-array 懸念は stale (`scope:'always'`で解決済)。
- **B07030** 黒羽快斗＆中森青子 — a1 後半「[ビッグジュエル]イベントを1枚まで選び、パートナーエリアに移す」
  = `atomToPartnerArea` (atom-handlers/core.ts:484-499) が `ctx.source.cardId` 固定の self-only
  決定論経路のみ、pick 対応なし。→ 追加: `toPartnerArea` に cardIds:'$pick.cardIds' 契約を追加
  (charSetCard/charStackCard と同型)。a2 `partnerAreaRemove`(filter対応済,cost/pay.ts:246) +
  `sceneEnter{enterSleep:true}`(shipped, D01012) は GREEN。
- **B08093は UI_UNLOCKED 節参照 (再掲なし)**
- **B09109** 怪盗キッド&安室透 — a1 は本 session 前段 wave で全部品 probe 実機検証済 = GREEN
  (dossier 自己申告、rider不在主張は偽)。a2「カード名を公開したキャラのカード名に書き換える」=
  `nameOverride` turnEffect (read/char.ts:351-354, candidates.ts:95-100) は既存だが、
  `revealFromHand` の costPaid に cardName が未記録 (cost/pay.ts:124-128 は `{ids,count}`のみ、
  `removeFromHand`の`level`記録と非対称)。→ 追加: revealFromHand costPaid に
  `cardName: readDef.card(ids[0])?.names[0]` を追加 (1行、level記録と同型)。
- **B09110** 赤井秀一&ジン — a1「リムーブしたキャラと**同じカード名**が出るまで公開 (最大10枚)、
  相手のデッキ」= B09109で shipped済の deckRevealUntil dyn 機構を流用できるが、(1) 除去キャラの
  **複数名 (rules/19 分割名) any-match** が未対応 (dyn/eval.ts 541-547 は先頭名のみ、B09109公式Q&Aでは
  edge-case 扱いだが B09110は自Q&Aで明示的に複数名対応を要求)、(2) 除去時点の名前を静的 bind する
  root が B08002 同様不在。→ 追加: 除去キャラ全名配列を bind する root + `deckRevealUntil` の
  cardName match を any-match に拡張。a2 (draw+`choice{options:[discard,sceneRemove(self)]}`,
  resolve-picks.ts:613/resolver.ts:117 で shipped) は GREEN。
- **B07049** フィリップ王子 — 「リムーブエリアかパートナーエリアの[ビッグジュエル]を1枚まで選び手札に
  加える」= `candidates()` は `query.area` 配列 union に対応済 (candidates.ts:177-184) だが
  `atomHandAddFromRemove` の multi-pick cardIds splice (atom-handlers/core.ts:987-1000) は
  `s.players[p].remove` 固定で `paCards` を見ない。→ 追加: handAddFromRemove に PA-source splice
  分岐 (charSetCard の `setSrcAreas` ループ、core.ts:293-306 と同型) を追加。
  旧 DEFER「候補側 union 不可」は stale (候補側は解決済、mutate 側のみ残)。
- **B09039** 中森青子 — B07049 と同一 gap (`handAddFromRemove` PA-source splice 不在)。a2
  `useEventFromHand`+条件付discard は GREEN。
- **B09055** 世良真純 — 「パートナーエリアかリムーブエリアにある[赤井秀一&世良真純]を1枚まで選び、
  登場させる」= `sceneEnter` の source-splice (atom-handlers/scene.ts:185-210) が
  `remove`/`hand`/`deck` のみ分岐、`partner-area`(paCards) 分岐が無い。→ 追加: sceneEnter に
  partner-area source 分岐 + remove との union。B09039/B07049 とは別 handler だが同根 (paCards
  未統合)。a1/条件群 (FILE8等) は既存多数exemplarでGREEN。
- **B07061** 日輪の後光の巻 (事件カード) — a2「リムーブエリアの[ビッグジュエル]を1枚まで選び、
  パートナーエリアに移す」= B07030 と同一 gap (`toPartnerArea` pick 非対応)。a1 (解決編トリガ+discard)
  はGREEN。PA宣言句なし (事件カードなので UI_UNLOCKED 非該当)。
- **B09027** 大岡紅葉 (非MR、PA宣言句なし) — cost `{kind:'choice', items:[removeSetCard,
  removeFromHand]}` は型定義済 (effect.ts:602) だが human 選択 UI が皆無、pay.ts は最初の
  payable branch を自動選択 (shipped exemplar 0件、dossier既存grounding確認済)。→ 追加:
  cost-choice 選択 UI + pay.ts の human 選択受理経路。既存 grounding で「W級 UI」と評価
  (他 SMALL_GAP よりスコープ大、単独 mini-wave 候補)。効果本体 (sceneSetState{state:'stun'}
  + TargetFilter{state:'sleep'}) は GREEN。

## 共通クラスタ (横展開)
- **paCards 未統合 (3件)**: B07049/B09039 (handAddFromRemove) / B09055 (sceneEnter) — いずれも
  `s.players[p].paCards` を source zone として見ない。1 mini-wave で3件まとめて解禁可能。
- **toPartnerArea pick化 (2件)**: B07030 / B07061 — 同一 handler 修正で両方解禁。
- **除去キャラ静的 snapshot 不在 (2件)**: B08002 (level) / B09110 (cardName配列) — `$discarded.*`
  と同型の `$removed.*` root 新設で両方に道が開く。
