# engine拡張 wave#2 cluster15 — removal-observer (反撃カード一族) 解禁 + 26枚出荷

**Round/Phase**: 2026-06-16 engine拡張 wave#2 cluster15 (`engine/wave2-cluster15-contact-removal-observer`)。
ユーザー判断で green候補刈り取りより **engine クラスタ拡張を優先**（残 green は 170 distinct の novel 裾、密ファミリーは
engine 拡張が製造する。memory `feedback-engine-cluster-over-green-tail`）。当初候補 cutin-subtype は sweep 誤ラベル
（『テキストに【カットイン】含む』の過剰グルーピング、真の subtype filter は ~1枚）と実証 → **contact-removal-observer
（反撃カード一族, 53枚）にピボット**。

## engine 変更 (骨格凍結例外 = scoped engine-extension wave、新 condition 1個・全 additive)

「相手の現場にいるキャラが…リムーブされたとき」を card-triggerable に。13198 の gap 分析を grounding。

- **`mutate/scene.ts removeToRemove`**: optional `byUid?` 追加 (default undefined = 既存 5 caller 不変)。
  `leave:to-remove` payload を `{uid,cause}` → `{uid,cause,side,byUid}` に additive 拡張 (side=除去キャラ所属 player、splice 前既取得)。
- **`flow/contact.ts judge`**: `removeToRemove(state, bUid, 'contact-ap', aUid)` (aUid=winner=attacker、rules/08: 被除去は常に bUid)。
- **`cond/eval.ts`**: 新 condition **`removedCharMatches{side,cause,by}`** — payload snapshot のみ読む (除去キャラは splice 済で
  triggerCharMatches の scene 再取得が使えない)。`by:'self'`(このキャラ) / `{filter,excludeSource}`(自分の現場の filter 一致、winner=生存=再取得可)。
- **3点同期**: Condition union + CONDITION_KIND_MAP + cjs CONDS (sync test + tsc satisfies が gate)。**atom-handlers/triggered.ts は不変**。

## 実装前 opus 3-lens 敵対設計レビュー (実害3件を捕捉)

`.claude/specs/engine-cluster15-contact-removal-observer-design.md`。全 GO-with-fixes。実装前に修正反映:
1. **B09026 誤分類** (CONTACT-BARE→実は cardName[伊織無我] filter、BARE のままだと over-fire) → CONTACT-FILTER 再分類。
2. **by に excludeSource 欠落** (B06067「このキャラ以外の警察」が表現不能) → `by:{filter,excludeSource}` 追加。
3. **level/ap effective capture が mutate→read 層越え import** (前例ゼロ・循環リスク、53枚どれも未使用) → payload から DROP、`{uid,cause,side,byUid}` に確定。

## 出荷 (26枚 = clean green 14 rep + byte同一 clone 12、ALL_CARDS 1301→1327)

28 rep を opus certify (grounding→敵対verify) → **verifiedOk green 15 / refuted 3 / yellow 7**。pure-JSON 自動 codegen 可能な 14 rep を出荷:
- CONTACT-SELF (10): D10007 B01007 B01010 B06031 B06051 B07017 B07084 B07097 B09023 (+clones)
- CONTACT-FILTER (3): D09010(特徴警察) B06067(警察+excludeSource) B09026(cardName伊織無我)
- CONTACT-BARE (2): B01030 B01031
- B06038 は partnerColorKeyword closure 要 (certify 分類漏れ) → needsManual 群へ DEFER。

## 検証 (全 green)

- engine unit test (`tests/engine/cond/removed-char-matches.test.ts`) **11 pass**: side/cause/by 全分岐 + pin (self-not-firing /
  excludeSource / cardName split-name rules/19 / partner-not-in-scene)。
- gate5 実機 (`tests/cards/cluster15-removal-observer.test.ts`) **8 pass**: end-to-end contact (declare→judge→aUid→byUid→draw 発火) +
  実カード全 variant + pin (cause filter / self-not-firing / CONTACT-BARE / trait / cardName)。
- tsc 0 / sync-whitelists pass / **vitest 2579 pass** (+19) / **smoke baseline winsA=498 不変** (新カードは MVP デッキ外 = 回帰0証跡) /
  playwright 119 pass / lint:* 8本 errors=0 / validate-specs pass=60 fail=0。

## DEFER (14 rep、反撃 ability 自体は green、他句が別 gate)

- **refuted 3**: B04004(a3 絆 reactive の actor-gate 欠落=over-fire) / B06087(cardName除外 filter + chain/optional 構造) / B09022(sceneSetState 自側限定 picked-sleep 不可)。
- **needsManual 4** (partnerColorKeyword closure、fast follow-up): B06038 B06039 B08010 B09071。
- **yellow 7** (secondary engine gate): D02008(action-scoped cutin-ban) B05009(own-side enterSource) B06068(turn-scoped keyword 剥奪) B07063(grant removal-observer ability) PR136(owner-deck-source charSetCard) PR280(cardName除外 filter) B05106(MR 未配線)。
- 新 gate 発見: **cardName-EXCLUSION candidate filter** (B06087/PR280)。DEFERRED-INDEX に記載。
