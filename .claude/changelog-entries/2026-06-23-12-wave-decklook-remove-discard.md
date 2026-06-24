# cards — wave decklook-remove-discard (越水七槻 / ラム 4枚、engine変更0)

**Round/Phase**: 2026-06-23 カード追加 wave (engine変更0、並行 MR engine session と協調)。
既存 DSL パターン (deck-look-select + sceneRemove + conditional discard + 宣言複合コスト) のみで実装。
全句を公式テキスト⇔shipped exemplar⇔engine コードで決定論 grounding。

## 出荷 (ALL_CARDS +4、engine変更0)

- **B03036 / B03036P 越水七槻** (緑 lv7 探偵):
  - a1【登場時】= deck-look-4 → 探偵キャラ1枚まで→手札 → 残りデッキ下 (deckRevealUntil upTo / handAddFromDeck / deckToBottomBound)。
  - a2【宣言】【ターン1】【スリープ】〚手札から探偵1枚リムーブ〛= 複合コスト pay[sleepSelf, removeFromHand探偵] →
    このキャラ以外 lv7以下 を1枚まで remove (excludeSelf) → このキャラをデッキ下 (sceneToDeck uid:'$self')。
- **B03115 / B03115P ラム** (黒 lv8 黒ずくめの組織):
  - a1【登場時】= lv7以下を1枚まで remove → deck-look-3 →【カットイン】持つ【黒】カード1枚まで→手札 → 残りデッキ下 →
    加えた場合 手札1枚 discard (bound $matched matched gate で over-fire 防止、B07010 教訓)。

## 検証 (engine変更0 ゲート)

- `taskA-validate-specs`: 私の4カード clean (唯一 FAIL=PR280 は既存・無関係)。
- `tsc --noEmit` 0 errors / `vitest` 2998 pass 0 fail / `smoke:1000` winsA=498 exceptions=0 baseline OK (**byte-identical** = engine変更0 証跡)。
- 敵対 faithfulness review (opus): 量指定子 / filter AND / deck-look semantics / conditional discard over-fire / 複合コスト / excludeSelf / sceneToDeck self を句単位突合。

## exemplar / DEFER

- exemplar: B05016・B07010 (deck-look upTo→handAdd→conditional discard) / B01063 (sceneRemove levelMax) /
  B07098 a2 (removeFromHand cost + keyword+color filter) / B05067 (explicit-target sceneRemove) / PR086 (sceneToDeck uid:'$self')。
- 同探索クラスタ DEFER 据置: B08050 (「【解決編】レベル+3」= continuous levelDelta gate、DEFERRED-INDEX L316 既存) /
  B04085 (stun verb 不在) / 各種 count-cond・cutin-use-reaction。
