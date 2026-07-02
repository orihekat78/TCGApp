# wave-9 — B09072 横溝重悟 (wave-8 shippuFiredThisTurn flag 初 consumer + carrier-reuse、engine変更0)

**Round/Phase**: 2026-07-02 engine-first フェーズ wave-9。E1 additive 枯渇・E2 structural 継続中だが、
wave-8 で出荷した `shippuFiredThisTurn` flag / `cannotReason` gate に **live consumer が存在しなかった**ため、
その E2E 検証を兼ねて exemplar カード **B09072 横溝重悟** を出荷 (engine変更0)。前 session の DEFER
「a2 は pick-bind carrier 不在で出せない (sceneSetState/charSetTurnEffect は bind 非対応)」を **実機 probe で反証** し訂正出荷した。

## 出荷カード (engine変更0)

- **B09072 横溝重悟** (SR、黄/lv6/ap5000/lp1、警察|神奈川県警) + parallels **B09072P / B09072P2**。
  - **a1** 【登場時】= triggered enter(selfOnly) → `conditional{ if:flag(shippuFiredThisTurn), then: [mill n:2, draw n:1] }`。
    **wave-8 flag の初 consumer** (「このターン中 自分のキャラの【疾風】が発動していた場合」)。mill = deck 上2リムーブ
    (deck<2 は refresh→残りリムーブせず→draw、公式Q&A と一致)。
  - **a2** 【宣言】【ターン1】cost `pay[sleepSelf, removeFromHand n:1]` (=【スリープ】+〚手札1リムーブ〛) →
    **carrier-reuse** `sequence[ sceneSetState carrier{player:self,max:1,side:either,filter{trait:神奈川県警},state:active,bind:$picked},
    charSetTurnEffect rider{uid:$picked.uid,key:cannotReason,val:true} ]`。「神奈川県警を1枚まで選び、アクティブにし、
    ターン終了時まで推理できないを与える」。cannotReason(素キー)=turn-scope (endTurn clearTurnEffects('turn') で失効)。
    ★`side:'either'` = 印字に「自分の」修飾が無い unscoped「〚特徴［神奈川県警］〛のキャラを選び」→ rules/15 (どちらの現場も可)。
    B05096/B03017 (side 省略=default either)・B06067 a2 (明示 either) の precedent と一致 (敵対 review grounding lens NIT を反映して
    side:'self'→'either' 訂正、相手対象は strictly self-harmful で実プレイ影響ほぼ無いが text fidelity)。
  - **a3** 【ヒラメキ】= triggered on-evidence(evidence:remove-by-action, optional) → draw n:1 (D01003 と byte 等価)。

## 前 DEFER の訂正 (false-DEFER の反証)

wave-8 は a2 を「pick-bind carrier 不在」で DEFER したが、実機 probe (AI / human pick / 0-pick decline の 3 経路) で
**sceneSetState 短縮形 carrier + charSetTurnEffect rider が既存 engine で完全に成立**することを確認した:
- `sceneSetState` は `ATOM_PICK_SPEC` の PA 短縮形 (needs 'state')。短縮形分岐は `player` 必須 (無いと silent no-op)。
- carrier の pick 解決後、`runAtom` preamble (atom-handlers.ts) が resolved uid + `bind` を `ctx.bindings['$picked']` に書込
  (**verb 非依存** = charModifyAP carrier / B02005・B03088 と同機序)。
- rider `charSetTurnEffect` は handler が `resolveBindRef(a.uid)` で `$picked.uid` を解決 → 同一キャラへ適用。
→ 「新 picker mechanism が必要」は誤診断。engine変更0 で出荷可能だった ([[feedback-carrier-reuse-human-path-empirical]] に従い
   code-reasoning ではなく実機 probe で判定したことで発見)。DEFERRED-INDEX の該当 DEFER を訂正済。

## 検証 (全 gate green)

- tsc 両 config clean / vitest **3608 pass +1 skip** (baseline 3602 + 本 wave 6) / smoke:1000 **winsA=498** 0-exc
  (MVP デッキ非採用ゆえ挙動不変) / 8 custom lint errors=0 / **engine変更0** (`git diff origin/main -- src/engine` = 0)。
- test: `tests/cards/wave-b09072-2026-07-02.test.ts` (descriptor / a1 E2E 疾風→mill+draw / a1 negative / a1 refresh-edge /
  a2 AI cost+carrier+cannotReason(canReason=false) / a2 human pick surface+trait-filter)。
- opus 4-lens 敵対 review (grounding / edge / additivity / carrier-reuse) 実施。

## DEFER 継続

- **P15 TargetFilter 軸** (B09070「疾風発動した全キャラを active化」) / **P16 疾風条件 override** (B09090) /
  **G17 boundDistinctColorCount** (B07002) は別 primitive (DEFERRED-INDEX wave7/wave8 節参照、いずれも非 sole)。
