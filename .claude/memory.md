# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-16-2.md = ⑮⑯⑰。⑭ batch#4 = CHANGELOG + changelog-entries/2026-06-16-3 + DEFERRED-INDEX に記録)

## 2026-06-16 セッション⑱ — cluster16 Commit2 出荷 (filter-predicate カード 11枚)

cluster16 engine (Commit1=2c0b492b、cardNameNot + deckReveal filterAny) を使うカードを **opus 再 certify → GREEN のみ pure-JSON 出荷**。
commit = `cards/wave2-cluster16-ship`。**ALL_CARDS 1327→1338**。

### certify (opus 9候補) → 仕分け
- **GREEN+verify-ok 7**: PR280 / B03113 / B03053 / B06081 / B03016 / B04012 / B07035。
- **出荷 6 reps + 5 clones = 11枚**: B03113(+B03113P) / B03053 / B06081 / B03016(+B03016P) / B04012(+PR026,PR030) / B07035(+B07035P)。
  - G1 cardNameNot: B03113 (反撃 summon)・B03053 (登場時 handAdd)・B06081 (ターン終了 remove)。
  - G2 deckReveal filterAny: B03016 (宣言 reveal)・B04012 (登場時)・B07035 (登場時+解決編 discard)。

### ★重要: certify の auto-spec バグを自己精査で捕捉 (verify が見逃し、速度<精度)
- **PR280 a2 over-fire バグ**: 存在しない `triggerCondition` フィールドを使用 → engine は `condition`/`trigger.matcherCondition` のみ評価 →
  silent ignore → 任意除去で over-fire。正解 = `condition:and[fileAtLeast6, removedCharMatches{side:opp,cause:contact-ap,by:self}]` (cluster15 D09010 と同型)。
- **PR280/B03053 a1 が shared-class を非codegen形式で出力**: PR280=`__sharedClass`文字列+grantKeywords closure、B03053=inline icon-misread+無効`__sharedNote`。
  正解は `{__shared:'partnerColorKeyword'|'misreadX', args:{...}}`。→ B03053 a1 を `__shared:misreadX` に正規化して出荷。
- 教訓: certify auto-spec は shared-class を系統的に誤形式で出す。**verify pass でも spec を自己精査必須**。

### DEFER
- **PR280 / B06087 / B06087P** (萩原千速 自己リムーブ反撃): GREEN だが a2 over-fire 手修正 + a1 partnerColorKeyword __shared + 初の自己リムーブ
  observer の novel re-entrancy。re-entrancy は **engine トレースで安全確定** (handleHook が effect を `event.queue` で deferred 化、再emit
  cause:effect/side:own は observer 条件 {side:opp,cause:contact-ap} に再合致せず cascade 不能)。**次バッチで手 author 出荷** (fix 既知)。
- **B09016** (円谷光彦「ミスリードしたとき」反応): card-triggerable hook 欠落 (misread は内部 reasoning:before-add 同期処理) → engine change 必須。
- **B07051** (桃井恵子): sweep が B03016 clone に誤 grouping、実は別カード (怪盗キッド/高校生 reveal)。同 G2 で出荷可能な未certify follow-up。

### grounding docs 更新 (誤 refute 防止)
certify-brief.md §cluster16 + capability-map.txt + wf-certify.mjs verify ヒントの「deckReveal は filterAny を読まない」stale 記述を cluster16 反映。

### 検証 (全 green、playwright は CI 委譲 = UI/engine 変更なし)
validate-specs pass=11 (engine変更0) / tsc 0 / **full vitest 5190 pass 0 fail** (+14) / **smoke baseline winsA=498 不変** (MVP外=回帰0) /
lint:* 8本 errors=0 (shipped=1338) / **gate5 `tests/cards/cluster16-ship.test.ts` 14 pass** (出荷カードの実 filter 値を decoy で「画面処理=テキスト文言」1対1検証)。

### 次セッション候補
- 萩原千速 pair 手 author 出荷 (a2=and[fileAtLeast6,removedCharMatches] / a1=partnerColorKeyword __shared / gate5 re-entrancy test) + B07051 同梱。
- partnerColorKeyword closure DEFER 群 (B06038/B06039/B08010/B09071/B04004 等) の __shared 手 author fast follow-up。
- 次 engine クラスタ / トリアージ出荷バッチ#5。
