# 2026-06-05 未検証パターン #1: effect:declared 他イベント反応 (+ Playwright 必須)

前段: [2026-06-04-pilot-impl.md](2026-06-04-pilot-impl.md)。user 指示「未検証パターンを1つずつ」+「プレイライトで必ず試す」。

## パターン #1 検証: on-scene キャラが「自分が色Xのイベントを使用したとき」反応
- 仕組み: triggered `effect:declared` (非selfOnly) + matcher。emit payload = `{kind:'event-use'|'character-use', cardId}`。
  matcher は `engine.cards.get(payload.cardId)` で使用イベントの色を判定 (B02010 の `engine` import 同型, 許容)。
- triggered listener は on-scene カードも effect:declared で走査 (collectCardsInPlay)、selfOnly 無しなら任意の event-use で発火。
- **★イベントは trait を持たない (全119 events traits:[])** → 「特徴[YAIBA]イベント」等の **trait matcher は永久不発火**。色matcherのみ可。

## 実装: B07016/B07016P/B07016P2 服部平次 (0748, ALL_CARDS→842)
- a1: 【自分T】【ターン1】緑イベント使用時→レベル8以下1枚リムーブ (sceneRemove 短縮形 pick, D08003/D11020同型)。
  matcher: kind==='event-use' && `engine.cards.get(cardId).colors.includes('緑')`。
- a2: 【パートナー緑】【宣言】【ターン1】cost(このキャラ以外のレベル5以上1枚sleep; D01003 sleepChar pick 同型)→突撃[事件]付与 (D11015同型)。

## Playwright 実機検証 (dev 5173 + __game)
- a1: **緑event(B02032)→服部平次a1 発火 (sceneRemove queue) / 白event(B06071)→発火せず** ✓ 色matcher 正。
- a2: grant 突撃[事件] ✓ / partnerColor緑 gate ✓ (青partner→ok:false)。cost は move-enumerator が `engine.cost.canPay` で gate
  (raw `dispatch` は低レベル mutator で gate 迂回=既知。canPay は evaluate.ts で sleepChar candidates 0→false)。
- console error は favicon 404 のみ (実エラー0)。durable: `tests/e2e/reuse-cards-2026-06-05.spec.ts` に a1 追加 (計4 e2e pass)。

## ⚠ 0678 ゲロ田 は DEFER
a1「【白】の〚特徴[YAIBA]〛イベント使用時」: イベントに trait が無い (data: 全event traits:[]) → trait matcher 永久不発火。
B07045 と同類の「未モデル precondition」gate。→ [card-impl-engine-gates.md](../specs/card-impl-engine-gates.md) に追記。

## 検証 (全 green, 未commit)
barrel 267→**270**, tsc 0, reuse-validate 0/0, registry ALL_CARDS 839→**842** 0 fail, vitest 1720 pass/1 skip, e2e 4 pass。

## パターン #2 検証: declared + 自己リムーブ (cost / effect) + 単一pick → 0363/0828 実装
- 自己リムーブ COST は既存実証済: B03055/B07007 が `cost: pay[sleepSelf, removeFromScene{target:{kind:'self'}}]`。
- **B03114/B03114P スコッチ (0363, 黒)**: コロン無 → コスト無、effect=sequence[sceneRemove($self), sceneRemove pick lv≤7]。
  Playwright実機: declare → **スコッチ自身が現場除去+リムーブ行き、効果はエラーなく継続** (rules/15) ✓。step2 pick は既存pick機構。
- **B07101 テキーラ (0828, 黒)**: cost pay[sleepSelf, removeFromScene{self}] → sceneSetState sleep pick lv≥5 (= B03055 同型)。
  実機: declare ok / 効果(sceneSetState)queue / no crash ✓。cost は move-enumerator が canPay で gate。
- durable e2e に B03114 自己除去テスト追加 (計5 e2e pass)。registry ALL_CARDS→**845**, vitest 1720 pass。

## proven-pattern scan で追加実装: D01010 円谷光彦 / D02009 遠山銀司郎 (misread1 + cutin AP+1000, D03010 同型)
パターン一巡後、proven-pattern スキャンで clean な2枚を実装。Playwright: 両者とも contact action-2 で cutin として pickable 認識 ✓。e2e に追加 (計6 pass)。

## proven-pattern batch #2: 6枚追加 (ALL_CARDS→853)
- **B05089/P/P2 上原由衣** (0587): 【事件編】登場→draw / 【解決編】登場→突撃[キャラ] (caseStatus gate)。Playwright: 事件編→draw, 解決編→突撃 ✓。
- **B04009 灰原哀** (0414): 宣言〚リムーブエリアに移す〛(removeFromScene self)→handAddFromRemove(【青】event, kind filter)。declare ok / 効果queue ✓。
- **B05018/P 円谷光彦** (0524): 宣言〚リムーブエリアに移す〛→charModifyAP(cardName灰原哀, +2000 turn, max1 pick)。declare ok ✓。
- 新知見: **`kind` は TargetFilter フィールド** (D11019 で kind:'character' 使用例)→「【青】のイベント」filter 可。

## proven-pattern batch #3: 3枚追加 (ALL_CARDS→856)
- **B04096/P 真実を覆い隠す霧** (0478): イベント使用→2ドロー。Playwright: deck 4→2 ✓。
- **B07071 アンドレ・キャメル** (0800): 突撃 + 【自分ターン中】手札2枚以下で自己AP+2000。手札枚数は declarative condition 無 → **custom{check} で hand.length<=2 を厳密判定** (D11013 同型)。Playwright: 手札2→AP8000 / 手札3→AP6000 ✓。custom は ctx.source?.player ガード付き。
- 注: full suite で `bug-077-evidence-to-hand-e2e` が稀に 5004ms timeout (5000ms limit 超過) で flake — 自カード無関係の既存 perf flake (再実行で green, D08013 テスト)。

## 本セッション(6/5)累計 実装 22枚 (ALL_CARDS→856)
PR174, PR192, B06071/P, B02032 (前半) + B07016×3 (#1) + B03114/P, B07101 (#2) + D01010, D02009 (cutin+misread) + B05089×3, B04009, B05018×2 (proven-batch)。
解禁パターン: forEach over:all / effect:declared色matcher / 自己リムーブ(cost&effect) / caseStatus-enter / handAddFromRemove(kind filter) / 単一pick charModifyAP / (既出 misread+cutin)。全て Playwright 実機検証 (e2e 7 pass)。

## パターン #3 検証: multi-target player-pick 各々に効果 → ★GATE (新規カード無)
- apply-pick.ts Pattern A(`uid:'$pick'`)は **単一 pickedUid のみ適用** (pickedUids 無視)。charModifyAP/sceneRemove/sceneSetState/charOverrideAP は全て uid 系 → 「N枚まで選び各々に」は **不可**。multi 適用は cardIds 系 atom (charStackCard) のみ。forEach over:pick は throw。
- → **0191 (5枚→各AP-1000) / 0528 (好きな数→各元AP0) DEFER**。scan した multi-select 候補も level-sum dyn / stacked-count grant / remove-area-source 等の別 gate 付きで clean 無。
- 例外(既出): 「すべて/全員」(player選択無)=forEach over:all (B06071/B02032) / 「N枚まで重ねる」=charStackCard multi (D08021)。
- gate を `card-impl-engine-gates.md` に追記。

## next
- 名前付き未検証パターン (#1 effect:declared色 ✓ / #2 自己リムーブ ✓ / #3 multi-target = GATE / #4 event-trait = GATE) は一巡。
- 残カードは proven-pattern (forEach-all/effect:declared色/自己リムーブ/enter-chain/continuous自己/declared+cost/misread/cutin/hirameki) への該当を1枚ずつ照合して実装する段階。多くは複数 gate 複合で defer 率高。
- 注: 自己リムーブを effect 先頭(非optional)に置く場合 rules/15 で効果継続が保証される事を実機確認済 (B03114)。optional「してもよい」自己犠牲は依然 gate。
