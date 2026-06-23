# engine拡張 wave — deck-mill-gated-chain (gated-mill 4枚)

**Round/Phase**: 2026-06-23 カード追加 wave#4 (A 継続、engine 拡張クラスタ)。残未実装を engine gate で棚卸 (4候補クラスタを
opus grounding で精査) → 「自分のデッキを上からN枚リムーブ**してもよい**。**そうした場合**〜」の **gated-mill chain** が
最小 additive (engine 1 file) で真 clean yield 4枚と判明。タグ仮説では gate 扱いだったが、実 gap は「mill が all-or-nothing
gate 信号を立てられない」一点のみ。

## engine 拡張 (additive、回帰ゼロ: gate 使用カード従来0、1 file)

`src/engine/effect/atom-handlers/core.ts` `atomMill` に `gate?:boolean` 分岐を追加:

- `gate:true` かつ `deck.length < n` のとき、**何もリムーブせず** `ctx.dyn.chainStepNoApply=true` を立てて return。
  chain (「そうした場合」) が break = 後続 consequence を skip。公式Q&A の all-or-nothing
  (B01044/B03094/B05061/B06016「『上からN枚リムーブする』が実行できない場合、それ以降の効果は解決できません」) を実装。
- `filePopToHand` / `evidenceToHand` と同型の `chainStepNoApply` chain-break パターンの再利用。
- `gate` 未指定/false は従来挙動 (可能な限りリムーブ + deck0時 refresh、B09064/B09104) を**完全保持** = 回帰ゼロ。
- args は `unknown` 型ゆえ `gate` 追加に AtomVerb union 変更不要。verb 名 'mill' 不変ゆえ
  validate.ts ATOM_VERB_MAP / taskA-validate-specs.cjs whitelist の 3点同期も不要。

回帰ゼロ証跡: gate 使用カード従来0 (B09064/B09104 は gate 無し=従来パス) / smoke winsA=498 baseline 不変
(新4枚は MVP デッキ外) / legacy gate-less mill 回帰 test。

## 追加カード (4 + パラレル4、ALL_CARDS 1387 → 1395、touched=各1)

- **B01044 / B01044P 怪盗キッド** (白8/怪盗): 【パートナー白】【登場時】デッキ上7枚 gated-mill → キャラ1枚まで選びデッキ下
  (condition partnerColor白 + optional{chain[mill{n:7,gate}, sceneToDeck{either,bottom}]})。※禁止 B02041 とは別個体。
- **B03094 / B03094P 萩原千速** (黄7/警察・神奈川県警): 【パートナー黄】〚突撃〛 (partnerColorKeyword) +
  アクション時 デッキ上2枚 gated-mill → アクション終了時まで自身 AP+1000
  (無条件 a2、Q&A「黄で有効なのは突撃のみ」/ action:declare selfOnly / chain[mill{n:2,gate}, charModifyAP{$self,+1000,action}] / 【ターン1】無し毎回)。
- **B05061 / B05061P 終極** (event 白6): 【パートナー白】デッキ上7枚 gated-mill → 相手の現場キャラ1枚まで選びデッキ下
  (event-use + condition partnerColor白 + optional{chain[mill{n:7,gate}, sceneToDeck{opp,bottom}]})。
- **B06016 / B06016P 鬼丸猛** (緑8/YAIBA): 【パートナー緑】【登場時】デッキ上3枚 gated-mill → AP8000以下を1枚まで選びリムーブ
  (a1: condition partnerColor緑 + optional{chain[mill{n:3,gate}, sceneRemove{apMax:8000}]}) +
  【宣言】【ターン1】【スリープ】証拠⇄手札 swap (a2: declared + sleepSelf + bare chain[evidenceToHand{max:1}, handToEvidence{n:1}]、B06029 と同型)。

## DEFER (同族)

- **B02052 / B02052P トランプ銃**: set-event (怪盗にセット→ターン終了時 gated-mill→stun 付与 + 【相手ターン中】replace-on-set-removal)。
  gated-mill 自体は表現可だが permanent grant 未検証 + set-card-removal の replace point が engine 不在のため DEFER (DEFERRED-INDEX)。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-deck-mill-gated-chain-2026-06-23.test.ts、23件): runAtom mill gate=true
  (deck≥N mill+chainStepNoApply無 / deck<N 0枚+chainStepNoApply=true / deck==N 境界) / legacy gate-less mill 回帰 (B09104 shape) /
  chain[mill(gate), draw] の consequence decoy で chain-break witness / optional gating / per-card 固有 N の gate /
  B03094 a2 golden full (gate+AP+1000 両 deterministic) / DSL 構造断言 / parallel 同一性。
- **敵対 faithfulness review** (opus workflow、engine lens + 4カード lens): 全 faithful (blocker 0)。
  B05061 の色制限 (rules/20) は engine 汎用 hand-use flow (colorAllowed: CardDef.colors ⊆ case.colors) で処理 = descriptor 非記載が全 event と同一規約で正。
- typecheck 0 (両config) / vitest 2845→2868 (+23、baseline 不変) / smoke winsA=498 exc0 baselineOK /
  e2e 123pass+1skip / 規約 lint 8本 errors=0。
