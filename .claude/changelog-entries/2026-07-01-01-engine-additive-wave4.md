# engine additive wave-4 (3 pure-additive primitive) — $self.level dyn / drawUpToHandSize verb / remove:exit observer

**Round/Phase**: 2026-07-01 engine-first フェーズ E1 wave-4 (engine/wave4-0701)。engine-extension-plan-2026-06-30 の
wave-4 候補を origin/main (80621194) 実 grep で stale 解消後、純 additive な primitive 3 件を **まとめて** 出荷 (0629d/wave-2/wave-3 方式)。
カード自身は別 card phase で出荷 (本 wave は engine 足場 + 専用 unit test のみ、engine-only)。

## engine 拡張: 純 additive 3 件 (新 symbol = 既存カード未参照 → 挙動不変)

1. **`$self.level` dyn** (G16-partial) — [dyn/eval.ts](../../src/engine/dyn/eval.ts) resolveSelf に `case 'level'` 追加
   (charRead.level = effective level = base+各 lvlMod+continuous、$self.ap/lp と対称)。「このキャラのレベル以下/同じレベルの〜」
   相対 level フィルタの dyn 足場。filter の `levelMin/levelMax` に `{dyn:'$self.level'}` を置くと resolveFilterDynObj
   (field-agnostic、既出荷) が具体値へ解決し matchOneFilter (effective level honor、既出荷) が評価 → dyn 1 case 追加で解禁。
   先例 = `$self.ap` (B09096 相対AP、既出荷)。continuousDeltaSafe 経由で BUG-156/157 の再帰を踏まない。level 下限なし (rules/19)。
   ★G16 の相対-LP は既出荷 (`$self.lp` + field-agnostic resolve で完結)、相対-level のみが残 gap だった。
   ★B04074 (発見カードと同 level)・B08043 (現場最大LP以下) は別 dyn ($revealed-level-any / sceneMaxLp) を要し本 wave 対象外。

2. **`drawUpToHandSize` verb** (P44-partial) — [atom-handlers/core.ts](../../src/engine/effect/atom-handlers/core.ts)
   「手札が N 枚になるまでカードを引く」(B08047 沖矢昴「ターン終了時、手札が2枚になるまで引く」)。`draw(max(0, n − 現手札))`
   の決定論 verb (atomDraw の薄いラッパー、pick 無し)。手札 ≥ N なら draw 0 (draw-up 方向のみ、捨てない)。デッキ不足時は
   mutate.deck.draw が rules/14 のリフレッシュ (可能な限り) を担う。discard-down 版 (B07076「N枚になるまでリムーブ」=pick 要) /
   引いた枚数 return (B04048) は別 variant で意図的に DEFER。

3. **`remove:exit` observer hook + `removeExitMatches` matcher** (P20) — 「自分のリムーブエリアにある〚特徴/種別〛の
   カードがリムーブエリアから離れたとき」(B05087 諸伏高明 / B05088 大和敢助)。**原因非依存** (リムーブ方法問わず、
   rules/17 【現場リムーブ時】類推)。emit は [mutate/remove.emitExit](../../src/engine/mutate/remove.ts) で payload
   {player, cardId} を単一ソース化し、**全 7 離脱経路を網羅** (離脱カード毎): ① deck.refresh (リフレッシュ remove→deck) ②
   remove.removeFromHere (removeAreaToDeckBottom コスト経路) ③ handAddFromRemove (remove→手札、B05087 第2能力) ④
   removeAreaAllToDeckBottom (B08027) ⑤ evidence.gainCard fromArea=remove (remove→証拠) ⑥ charSetCard fromSelf (使用イベント
   自身を remove→set-card) ⑦ sceneEnter sourceArea=remove (remove→登場、B05087 1st 能力経路)。除外 = scene.ts MR→PA redirect
   pop (在場→PA 転送中の transient、leave:to-remove 既 emit、rules/18①)。matcher [cond/eval.ts](../../src/engine/cond/eval.ts)
   `removeExitMatches` は離脱カードの cardId→CardDef を matchOneFilter(c=null = 印字値) 評価 (remove-area card は turnEffects 無
   = 静的 def、setCardMatches/triggerCutinMatches/boundMatchesFilter と同流儀)。side='self' (省略時) = payload.player===source.player。
   listener = 在場キャラ → 通常 in-play scan (handleHook) で処理 = 特別 handler 不要 (wave-3 と同論拠)。
   ★初版は emit を refresh+removeFromHere のみに限定していたが、opus 4-lens SEMANTIC review が「契約は『原因非依存』を主張するのに
   主要効果経路 handAddFromRemove (=B05087 自身の能力) が emit せず B05087/B05088 の自己相互作用が壊れる」を BLOCKER 検出 →
   全離脱経路へ emit 拡張 + emitExit 単一ソース化 + stale コメント (cost/pay.ts「removeFromHere は emit しない」) 是正で対処。

## 検証 (セルフレビュー + 水平展開 + opus 4-lens 敵対 review)

- tsc 0 / vitest **3462 → 3489 pass** +1 skip (新規 27: $self.level 5 + drawUpToHandSize 5 + remove:exit 17。
  false-green 防止 decoy: lvlMod 合算 / マイナス level / 算術 / uid 不在 throw / 手札超過 no-op / デッキ不足リフレッシュ /
  opp 不変 / matcher 特徴・kind gate 不一致 / opp-side pin / removeFromHere id 不在 / 全 5 離脱経路 emit / 複数枚 partial /
  side=opp / removeFilter 省略 全一致 / 不正 payload 防御)。
- sync-taskA-whitelists green (VERBS+ATOM_VERB_MAP に drawUpToHandSize、HOOKS+TRIGGERED_HOOKS に remove:exit、
  CONDS+CONDITION_KIND_MAP に removeExitMatches を両方登録)。tsc `satisfies Record<AtomVerb/Condition, true>` が登録漏れ検出。
- smoke:1000 **winsA=498・winsB=502・timeouts/exceptions 0** = baseline 不変 (= 既存カードのパス不変の実証。
  refresh shuffle / handAddFromRemove / evidence.gainCard 等 hot-path に emit を挿入したが listener 0 で
  pendingEffects 不変 → 決定論不変。hot-path 拡張後に full vitest + smoke 再実走で回帰0 確認)。
- 8 lint errors=0。opus 4-lens 敵対 review = ADDITIVITY SHIP / DSL-TRAP・EDGE-TEST SHIP_WITH_NITS (全 NIT 対処) /
  SEMANTIC は初版 BLOCKER (emit 経路不足) を全離脱経路 emit 拡張で解消。engine-only (card consumer 無) ⇒ playwright N/A。

## card-wave 時の latent (要 DEFERRED 記録)

- remove:exit の **複数枚同時離脱** (refresh で N 枚一致) 時の発火回数は per-card emit。実カードの公式裁定 (1回 or 一致枚数分) は
  card-wave 時に B05087/B05088 個別 Q&A で確認。
- drawUpToHandSize でデッキ不足→リフレッシュ発火時の相手証拠+1 副作用は rules/14 通り (verb の責務外、deck.draw 内)。
