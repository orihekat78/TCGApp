# triggered-draw wave — reactive 【ターン1】「〜したとき、引く」4枚 (engine変更0)

**Round/Phase**: 2026-06-23 カード追加 wave (A 継続)。refactor-plan 全完了後の初カード wave。残 green 候補
(catalog-survey 2026-06-06 master 266 中 未出荷 154) を実テキストで密度検証 → **triggered-draw** 族 (反応型
【ターン1】「〜したとき、カードを引く (+手札リムーブ)」) を engine 不触クラスタとして選定。既存 hook
(action:declare / contact:start / disguise:into / enter / evidence:remove-by-action) に matcherCondition で mapping。

## certify (opus grounding → 敵対的 verify) → green 4 / yellow 4

8 候補を `scripts/wf-certify.mjs` (grounding→adversarial verify、両 lens `model:'opus'`) で裏取り。
全 verdict は durable に `.tmp/certify/<rep>.json`。**green+verify-ok 4枚を出荷**、yellow 4枚は engine-gate で DEFER。
codegen 前に **spec 自己精査** (memory: certify-spec-self-review) で `payloadKey` / `excludeSource` /
`matcherCondition` が実 engine field (effect.ts:79 / eval.ts:316,332 / card-def.ts:61、Task D E2/E4) かつ
shipped exemplar (B04004 a3 / D04007 / B08048) で exercise 済を全句確認 (捏造フィールド無しを確証)。

## 追加カード (4 base、ALL_CARDS 1374 → 1378、touched files = 各1)

- **B01071 ジェイムズ・ブラック** (赤7/FBI): a1 自FBIキャラ action→draw / a2 相手が自FBIキャラ指定 action→draw
  (B04004 a3 の actor+target dual-gate matcherCondition を trait:FBI に差替)。codegen 自動。
- **B02079 千葉和伸** (黄6/警察): a1【自分ターン中】自警察キャラ contact→draw+discard (contact:start + or[aUid/bUid self 警察])
  / a2 ヒラメキ draw。codegen 自動。
- **B03058 茶木神太郎** (白5/警察): a1【自分ターン中】このキャラ以外が変装→draw (disguise:into + excludeSource)
  / a2 ヒラメキ draw。codegen 自動。
- **B07050 藤江** (白4/高校生): a1 小泉紅子登場→draw (enter observer、非selfOnly + cardName matcherCondition)
  / a2 カットイン AP+1000、小泉紅子相手なら代わりに+3000 (`contactTargetMatches` __shared closure、手書き=needsManual)。

## engine 変更ゼロ + decoy 検証

- `src/engine` 不変 (`git status src/engine` clean)。骨格凍結原則遵守。touched: _reuse/index.ts (register) + 4 card files + 1 test。
- **回帰ゼロ**: typecheck 0 (両config) / vitest 2783→2802 (+19 新 test、baseline 不変) / smoke baseline 不変
  (avg 10.998 / winsA 498 / exc 0、4枚は MVP デッキ外ゆえ smoke 不変が engine変更0 の証跡)。
- **decoy 検証** (`tests/cards/wave-trigdraw-2026-06-23.test.ts` 19件): 実 hook を grounded payload で emit し
  pendingHirameki / pendingEffects で発火を decoy 込み検証 (BUG-117/118 教訓: DSL に書いても engine 実評価保証なし)。
  trait/色/excludeSource/cardName/turn-gate/action[事件]除外 が全て語義通り gate することを確認。

## DEFER (yellow 4、engine-gate)

B01075/B01089 (除去キャラ自身を色で絞る trigger — leave payload に除去キャラ stat 無), B02062 (opp-evidence-removed
observer hook 不在), B03008 (active→sleep state:change hook が internal-only)。各ヒラメキ等の副 ability は単独 green
だが main trigger gate ゆえ部分出荷=faithless で全体 DEFER。詳細: [DEFERRED-INDEX.md](../specs/DEFERRED-INDEX.md)
§triggered-draw wave。
