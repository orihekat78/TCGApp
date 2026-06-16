# engine拡張 wave#2 cluster16 出荷 — filter-predicate カード 11枚 (cardNameNot + deckReveal filterAny)

**Round/Phase**: 2026-06-16 cluster16 Commit2 (`cards/wave2-cluster16-ship`)。cluster16 engine (Commit1 = 2c0b492b) で
解禁した 2 capability を使うカードを **opus 再 certify (grounding→adversarial verify)** → **GREEN のみ pure-JSON codegen** で出荷。

## 出荷 11枚 (ALL_CARDS 1327→1338、engine 変更 0)

| capability | reps | clones |
|---|---|---|
| **G1 cardNameNot** (「〚カード名X〛以外」除外) | B03113 (シェリー/反撃 summon)・B03053 (鈴木綾子/登場時 handAdd)・B06081 (保本ひかる/ターン終了 remove) | B03113P |
| **G2 deckReveal filterAny** (cross-field OR) | B03016 (円谷光彦/宣言 reveal)・B04012 (毛利蘭/登場時 reveal)・B07035 (古畑恵/登場時 reveal+解決編 discard) | B03016P・PR026・PR030・B07035P |

## certify (opus、9 候補) → 仕分け

- **GREEN+verify-ok 7**: PR280・B03113・B03053・B06081・B03016・B04012・B07035。うち **6 reps を出荷**。
- **DEFER (本セッション)**:
  - **PR280 / B06087 / B06087P** (萩原千速、自己リムーブ反撃+cardNameNot summon): GREEN だが (1) auto-spec a2 が
    存在しない `triggerCondition` フィールドを使い **over-fire バグ** (engine は `condition` / `trigger.matcherCondition` のみ評価。
    正解 = `condition:and[fileAtLeast6, removedCharMatches{side:opp,cause:contact-ap,by:self}]`)、(2) a1 partnerColorKeyword closure
    の __shared 手書き、(3) **初の自己リムーブ removal-observer** (novel re-entrancy)。re-entrancy は engine トレースで安全と確定
    (`handleHook` が effect を `event.queue` で deferred 化、再emit cause:'effect'/side:own は observer 条件 {side:opp,cause:contact-ap}
    に再合致せず cascade 不能) だが、専用 gate5 テストが要るため **次バッチで手 author 出荷**。
  - **B09016** (円谷光彦、「ミスリードしたとき」反応): **card-triggerable hook 欠落**。misread は内部 `reasoning:before-add` で
    同期処理され、TRIGGERED_HOOKS に「自分が misread した」sign号が無い → engine change (新 hook emit+register) 必須。DEFER。

## 検証ゲート (全 green)

- certify grounding docs を cluster16 反映 (certify-brief.md §cluster16 + capability-map.txt + wf-certify.mjs verify ヒント、
  旧「deckReveal は filterAny を読まない」stale 記述が誤 refute を招くため更新)。
- B03053 a1 を `__shared:'misreadX'` に正規化 (certify が inline icon-misread + 無効 `__sharedNote` で出力していた)。
- validate-specs pass=11 (engine変更0) / tsc 0 / **full vitest 5190 pass 0 fail** (+14) /
  **smoke baseline winsA=498 不変** (新カードは MVP デッキ外=回帰0) / lint:* 8本 errors=0 (shipped=1338)。
- **gate5** (`tests/cards/cluster16-ship.test.ts` 14 pass): 出荷カードの **実 filter 値**を抽出し decoy 盤面で「画面処理=テキスト文言」
  1対1 検証 — cardNameNot 除外 (除外名 drop + Lv/色/カットイン/特徴 各条件) + deckReveal filterAny OR (各枝 match + 非該当 null +
  base kind:character の AND で同名 event 除外 [B04012] + 「カード」kind 無制約で event 許容 [B07035])。

## follow-up

- **B07051** (桃井恵子): sweep が B03016 clone に誤 grouping したが別カード (怪盗キッド/高校生 reveal)。同 G2 capability で出荷可能な未certify候補。
- DEFER 詳細: [DEFERRED-INDEX.md](../specs/DEFERRED-INDEX.md) cluster16 セクション。
