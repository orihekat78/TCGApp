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

## セッション⑲ (2026-06-18) — 萩原千速 trio 出荷 (cluster16 fast-follow)
branch `cards/wave2-cluster16-hagiwara-pair`。cluster16 ship で DEFER した PR280/B06087/B06087P を手 author 出荷 (ALL_CARDS 1338→1341)。
- a1 = partnerColorKeyword({color:'黄',kw:'突撃'}) __shared / a2 = removal-observer: condition and[fileAtLeast6, removedCharMatches{opp,contact-ap,self}] + trigger leave:to-remove + optional{sequence[sceneRemove $self, sceneEnter{cardNameNot:萩原千速,trait:警察,levelMax:7,kind:character,from:hand,max:1,viaEffect}]}。B05108(body)+D10007(observer)+B09023(and)の合成。
- DEFER blocker 解消: over-fire `triggerCondition`(engine非実在)→`condition`へ / partnerColorKeyword closure→__shared / 初の「removal verb in effect + 【ターン1】無し」removal-observer→専用テスト。
- gate5+安全テスト `tests/cards/hagiwara-self-remove-observer.test.ts` 9 pass (filter 1対1 decoy [cardNameNot/trait/levelMax/kind/split-name/近縁trait] + trigger gating + 自己cascade非再帰pin)。
- ユーザー要望で **敵対 Workflow** (opus 4 lens 並列+synthesis): 意味等価/再入安全/gate5網羅/rules整合 全 pass、ship:true、blocker0。
- 全ゲート: tsc0 / vitest 全pass(減なし) / smoke baseline winsA=498不変 / engine変更0。playwright は非MVPカードのため gate5 vitest で代替 (cluster15/16 と同方針)。
- 残 follow-up: B07051(桃井恵子, deckReveal filterAny, 未certify)。
- 教訓: certify auto-spec の `triggerCondition` over-fire は出荷前自己突合で捕捉 (verify透過)。novel re-entrancy は「再emit payload が condition leg を再合致できるか」を3 leg独立で確認すれば安全証明可。

## セッション⑳ (2026-06-18) — 桃井恵子 B07051 出荷 (cluster16 G2 follow-up)
branch `cards/wave2-cluster16-momoi-b07051`。⑲ 残 follow-up の B07051 を certify→出荷 (ALL_CARDS 1341→1342)。
- a1 = `【宣言】【スリープ】：デッキ上1枚公開 → 〚カード名[怪盗キッド]〛か〚特徴[高校生]〛のキャラなら手札、それ以外デッキ下`。
- certify = 出荷済 **B03016 円谷光彦 の文字単位 twin** (阿笠博士→怪盗キッド / 少年探偵団→高校生 の leaf literal 2箇所のみ)。DSL は B03016 a1 と byte-identical。
- 手 author: card file (clone B03016) + `_reuse/index.ts` 登録 (taskA codegen 対象外 = green候補マスタ未生成のため)。
- gate5 `tests/cards/B07051-momoi-deckreveal.test.ts` 9 pass: filter 実評価を **outcome (手札/デッキ下) で 1対1 証明** (kind:character 違反 event decoy 2 + 両枝非該当 decoy + split-name複合名 + only-top-1 reveal pin)。「のキャラ」= kind:character (B07035「のカード」= kind無し との違いを decoy で固定)。
- 敵対 certify (opus 1 lens) equivalent:true/ship:true/blocker0。tsc0 / vitest 5222全pass / smoke baseline winsA=498不変 / engine変更0。
- 学び: `canDeclaredAbility` は cost.canPay を gate しない (存在/limit/condition のみ。sleep cost gate は別 = `engine.cost.canPay`。docstring 明記)。gate5 で誤って canDeclaredAbility(sleep)=false を期待 → 修正。

### 次セッション候補
- partnerColorKeyword closure DEFER 群 (B06038/B06039/B08010/B09071/B04004) の __shared 手 author fast follow-up。
- 次 engine クラスタ / トリアージ出荷バッチ#5 (triage-sweep-2026-06-15.md、gate ラベルは過剰グルーピング → 実テキスト決定論分類で密度検証)。
