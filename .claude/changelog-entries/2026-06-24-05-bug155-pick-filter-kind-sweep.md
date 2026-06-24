# cards — BUG-155 水平展開 sweep: pick filter の kind 種別制約を全カード忠実化 (engine変更0)

**Round/Phase**: 2026-06-24 cards/bug155-pick-filter-kind-sweep。PR235 で派生発見した
「公式テキストが種別 (キャラ/イベント) を明示するのに pick filter が `kind` を欠く」忠実性ギャップ
(BUG-155) を、全カード対象の決定論 sweep で完全棚卸し修正。

## sweep (決定論)

ALL_CARDS を runtime ロードし全 ability の effect/condition/cost を walk、pick系 atom
(`discard`/`handAddFromRemove`/`sceneEnter`/`charStackCard` 等) と全 TargetQuery の filter を抽出。
**mixed-area (手札/リムーブ/デッキ) で trait/color/keyword 絞り込み ∧ kind 欠落** = 50 カード/59 filter。
scene area は char-only ゆえ除外 (kind 省略は無害)。各候補の公式テキストを直読し種別語で分類:

- 「キャラ」明示 (trait/color/keyword gap) → 19 カード: `kind:'character'` 付与
- 「イベント」明示 (B07062 〚赤魔術〛) → 1 カード: `kind:'event'` 付与
- 「カード」(種別非限定で正) → 9 カード: 無修正 (kind 入れる方が不忠実)
- cardName 限定 (種別冗長・house convention=省略) → 21 カード: 無修正

## 修正 (20 ファイル / 22 edit, engine変更0)

fix-character (19): B02009 B04008 B04056 B05055 B05083 B05112 B07018 B07088 B08009 B08039
B08065 B09018 B09029 B09049 D08003 D08021 D08024 D11014 PR235(→PR241 spread連動)。
fix-event (1): B07062。

### ⚠ live bug 発見・修正: B05112

「【カットイン】を持つ【黒】の**キャラ**を登場」が kind 欠落により カットイン **イベント** B04096
(黒/Lv5) を sceneEnter (登場=キャラ専用) で候補化し得る実害バグだった。対照: B06100
「【カットイン】を持つ【黒】の**カード**」は kind 非限定が正。同一 filter 形がテキストの
キャラ vs カードで正否反転 = 忠実性ギャップの核心。real-risk 突合で挙動が変わるのは B05112 のみ
(他 18 は latent ev=0=挙動不変) と確認。

## ゲート

- 決定論 sweep 再実行: 59→45 finding (修正 22 件全クローズ、残 45 = 確定 no-fix)。
- tsc 0 / eslint 0 / vitest 3037 pass (1 skip; bug155 test +25、既存 3012 不変) /
  smoke:1000 winsA=498 (baseline 不変) / lint:bugs errors=0。
- 回帰テスト `tests/cards/bug155-pick-filter-kind-2026-06-24.test.ts` (25 件): behavioral
  (matchOneFilter が wrong-kind decoy を除外 = BUG-117/118 教訓の実評価) + structural (全 21 カードの kind 保持)。
