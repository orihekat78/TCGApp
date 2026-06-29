# engine additive wave (2 primitives) — cross-side numeric aura / printed-keyword turn-revoke

**Round/Phase**: 2026-06-29 engine 拡張 wave (engine/bulk-additive-0629b)。NEXT-PROMPT option-B「certify yellow の engine gate」群を
現 origin/main (62eaf331) ソースで再採寸。**DEFERRED-INDEX が大量に stale** と判明 (removeSetCard cost / lvlDelta / handReveal /
ability-presence filter via defHasKeyword / boundMatchesFilter / enterSource cond は全て出荷済 → 旧 yellow 群は card-wave 案件に格下げ)。
真に未実装かつ純 additive な 2 件のみを **まとめて** 出荷。カード自身は別 card session (session67/68 と同方針、本 wave は engine 足場 + 専用 unit test のみ)。

## engine 拡張: 純 additive 2 件 (新 symbol = 既存カード未参照 → 挙動不変)

1. **cross-side 数値 aura** (`continuousModifier.apDeltaAuraOpp` / `lpDeltaAuraOpp` / `auraFilterOpp`)
   — [read/char.ts](../../src/engine/read/char.ts) `auraDelta` が **target と反対 side** の bearer も走査し、bearer の
   `ability.condition` を bearer 自身の side で評価、`auraFilterOpp` 一致時に `*Opp` を加算する。cluster13 aura (同 side 限定)
   と完全対称・**honor site 共有** (read.char.ap/lp + candidates.matchOneFilter は従来どおり `auraDeltaSafe('apDeltaAura')` を呼び、
   内部で cross-side も合算 = 新 honor site 無し、再帰 guard も同一)。auraExcludeSelf は cross-side で bearer≠target 常成立ゆえ非適用。
   → **B03033 遠山和葉**「【自分ターン中】相手の現場にいるカードがセットされているキャラをAP-1000」を解禁
   (`apDeltaAuraOpp:-1000, auraFilterOpp:{hasSetCards:true}`、sole gate)。
2. **ターン終了時まで印字キーワードを失う** (`turnEffects['revokedKeywords']` + `mutate.char.revokeKeywordTurn` +
   `charRevokeKeyword scope:'turn'`) — [read/char.ts](../../src/engine/read/char.ts) `keywords()` が **印字 (base) + 自身の
   continuous grantKeywords のみ** から減算。granted / turnGranted (外部カード付与) は減算しない → 公式 B06068 Q&A
   「失った後に他カードの能力/効果で 突撃[キャラ] を再付与されたらアクション[キャラ]を行える」(再付与は「失う」効果と独立に復活) を満たす
   (敵対 review semantic lens の指摘を反映)。[mutate/char.ts](../../src/engine/mutate/char.ts) `clearTurnEffects('turn')` で清掃。
   既定 scope `permanent` は従来の granted-splice = 不変。**現出荷カードに charRevokeKeyword 使用は0件**。
   → **B06068 京極真**「ターン終了時までこのキャラは〚突撃[キャラ]〛を失い、〚突撃[事件]〛を持つ」を解禁 (sole gate、他句は既存機構)。

## 検証 (セルフレビュー + 水平展開 + 4-lens 敵対 review)

- tsc 0 / vitest **0 fail** (新規 11: cross-side aura 5 [AP-1000 / LP-1 / 同side不変 / opp-turn gate / matchOneFilter parity] +
  printed-keyword revoke 6 [turn消滅+復活 / 再付与で復活 (Q&A) / verb経路 / permanent非適用 / granted従来挙動 / 不変])。false-green 防止 decoy 込み。
- smoke:1000 **winsA=498 / winsB=502 / avgTurns 11.00 / p50=11 / p95=13 / max=16 / timeouts=exceptions=0** = baseline 全項目一致
  (check:smoke-baseline OK) = 既存カードのパス不変の実証。
- 8 規約 lint + eslint (changed files) green。opus 4-lens 敵対 review (semantic / additivity / recursion-perf / dsl-edge) = **全 ship・blocker/major 0**。
  semantic lens の re-grant 復活指摘を refine で反映 (revoke は printed/continuous のみ減算)。

## DEFER (本 wave 不採用、card-wave / 後続 engine へ回送)

- **PR136** charSetCard owner-deck-source: 反対側 pick + 持ち主デッキ source は **pick 解決後** の deck-source 解決が要 (短縮形は
  await 前に resolvePlayer 確定) ゆえ非 clean-additive。後続。
- **B05009** enterSource side-qualifier: enter payload に sourcePlayer emit 追加が要 (cond 単独では不可)。後続。
- **card-wave 案件** (engine 既存で解禁可、本 wave 対象外): B08033 (removeSetCard cost 済) / B08082・B08093 (ability-presence filter 済) /
  B07022 (handReveal bind + boundMatchesFilter 済)。
