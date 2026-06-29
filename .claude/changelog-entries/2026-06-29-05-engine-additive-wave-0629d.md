### engine additive wave 0629d — 5 純 additive primitive (engine-only)

未実装カードの distinct エンジン拡張需要 (full backlog 561枚、firm 上限 ~75) を再採寸し、
**真に未実装かつ pure-additive (挙動不変)** な 5 primitive をまとめて 1 commit で追加 (カード追加は別 session)。
12 候補を opus workflow で再採寸 → 7 は stale-shipped/YAGNI/L-subsystem で除外、5 を確定:

- **`sceneLpSum` Condition** (`{query, min?, max?}`) — 現場キャラの LP **合計** を範囲比較。`lpAtLeast`(per-char) /
  `sceneHas`(枚数) では合算不可。負 LP も合計 (公式Q&A B06003)。需要 B06003 a2「現場3枚以上かつ LP合計2以下」。
- **`souza` `bind` arg** — 捜査の「発見された」カードを `ctx.bindings` へ束ね、既存 `boundMatchesFilter` で参照
  (consumer 0 新規)。需要 B01084「レベル5以上が発見された場合」(捜査1=X1、bound[0])。X>1 の any-match は follow-up。
- **`charSetCard` `fromSelf` arg** — 使用イベント自身 (`ctx.source.cardId`) を remove から引き、自分の現場の
  キャラ1枚へ **faceUp** セットする WRITE 経路。session70 の on-set-host READ infra を end-to-end 化。
  需要 B01023/B01057/B02013 (装備イベント)。
- **`canCutIn` action-scoped cutin ban** — actor の `cutinBanOpp_action` turnEffect (`_action` suffix=アクション
  終了時清掃) を honor。継続 aura でなく窓限定。write は既存 `charSetTurnEffect`。需要 D02008/B05007。
- **`costRemovedMatches` Condition** (`{filter, n?}`) — `removeDeckTop` コストで除去したカードの素性で分岐。
  cost が除去 cardId を `ctx.costPaid` へ記録、`matchOneFilter(c=null)` で印字判定。需要 B03003/B04077/B06078。
  cost-path のみ (effect-path「これによって」B05068 は follow-up)。

付随 engine fix (敵対 review major 起因): 宣言能力の `conditional{if:costRemovedMatches}` は STABLE 扱いで runtime
resolver が `if` を再評価するが、`entryToCtx` が `costPaid` を queue 境界で落とすため常に false 化していた。
`EffectStackEntry.costPaid` を追加し declared-ability の `event.queue` で entry へ載せ `entryToCtx` で復元
(bindings BUG-082 と同型)。E2E テスト (activateDeclaredAbility→runAllUntilEmpty) で then-branch 発火を実証。

全 5 とも既存登録カード未使用 ⇒ smoke baseline 不変 (winsA=498/avgTurns=11/0 timeouts/exceptions、決定論一致)。
tsc0 / vitest 3392 (baseline 3370 + 専用テスト 22) / sync-whitelist 5/5 / 8lint err0。
opus 4-lens 敵対 review。新 Condition 2種は union + CONDITION_KIND_MAP + validate-specs CONDS の 3点同期。
