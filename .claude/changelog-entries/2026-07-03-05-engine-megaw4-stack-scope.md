# feat(engine): mega-wave W4 — stack/scope 8 primitive + exemplar 9 printings

- **r82 bindPick** — pick-only bind atom (共有 pick → 排他 conditional 分岐)。+ `hasFaceDownSetCards` filter / charRemoveSetCard `faceDownOnly` (「裏向きで」の DSL 化)。exemplar **B08035 怪盗キッド**。
- **r83 enter:group** — 効果登場 batch 単位 hook (viaEffect gate) + TargetQuery `fromGroup` (「その中から1枚」母集合限定) + emit bindings の gate ctx 貫通 + 凍結 bindings shallow-copy。exemplar **B01012 阿笠博士**。B08003 は stacked-identity 不在で DEFER。
- **r5 scene→stack** — `mutate.scene.toStack` (非リムーブ離場、rules/16 cascade、**MR 非redirect** = B09048 公式Q&A) + charStackCard `fromSelf`。exemplar **B06008/P 仮面ヤイバー**。
- **r6/r7 stack-under cost** — `sceneStackUnderSelf` / `handStackUnder` (公開 emit 込み) Cost 2種。exemplar **B09048 中森銀三 / B08006 小嶋元太**。
- **r84 perSideMax** — TargetQuery side 毎 quota (resolve validate + chooseAiPick greedy + pending 伝播)。B08019 は scene multi-pick human UI gap (pre-existing B02033 同型) で DEFER = engine-only。
- **r62 filtered-突撃** — `grantFilteredAssault` (「突撃[レベル4以下のキャラ]」per-target evaluated level) + **BUG-168 bundled fix**: canAction('any') が 突撃[キャラ]/[事件] 変種持ちを許可 (AI/UI actor 列挙から合法手が消える latent bug、分離実測で smoke re-baseline winsA 498→472)。exemplar **B07096 ウォッカ** + 共通クラス partnerColorFilteredAssault。B08074 は trait-declare 未実装で DEFER。
- **r1 protection rider** — opponentRestrict `remove|sleep|stun` + `read.char.charProtectedFrom` (per-target、faceUp setCards on-set-host rider walk = P01 gate#3 解禁) + atomSceneRemove/SetState narrow-gate (相手発 effect のみ)。exemplar **B05041/P イベント**。
- 混成 review (sonnet5+opus → lens 割れ → **fable 裁定 SHIP_WITH_NITS 0-blocker**)。スタン×相手 activate 貫通は公式Q&A 整合で棄却 → 解釈 pin test + comment 収録。BUG-169 (既出荷 3 枚の faceDownOnly 未移行) 起票。
- gates: tsc0 / vitest 3938+1skip (probe 46) / smoke 1000 exceptions=0 (re-baseline 472) / 8lint OK。
