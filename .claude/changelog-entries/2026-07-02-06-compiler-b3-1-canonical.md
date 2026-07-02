# Track B — B3-1 conflict canonical 化 (射影正規化 N1-N5) + B3-3 exceptions 監査完了

**Round/Phase**: 2026-07-02 Track B (B3 監査 queue 完遂)。engine 変更 0。

## B3-1: conflicts 5 → 0 — shipped 再編集ゼロの「意味射影正規化」方式

多数 shipped card の再編集 (初案) ではなく、**canonical.cjs の意味射影に「engine 直読で結果同値と
証明した encoding 揺れ」の正規化 N1-N5 を追加**して conflict を解消 (証明脚注は canonical.cjs 冒頭):

- **N1** singleton-choice unwrap (resolve-picks の `options.length>1` gate + resolver default idx 0)
- **N2** `trigger.matcherCondition`→`condition` lift (**removedCharMatches 限定** — enterOrderEquals は
  abilityIsShippu が存在自体を読むため除外)
- **N3** charSetCard `faceUp:false` drop (下流 falsy 読取、C3 裁定準拠)
- **N4** sceneSetState PA 短縮形 → 明示 pick 形展開 (**effect-root 限定** — BUG-145/158 の
  conditional/sequence 内非同値を尊重、buildShortFormPick の忠実 mirror)
- **N5** icon-disguise の配列位置 stable-move (engine 消費は presence-scan 2 箇所のみ、実測 19 枚中
  先頭 6 / 非先頭 13 で慣行不在)

真の fidelity drift は 1 件のみ: **C2 B03012 a2 の `kind:'character'` 過剰制約** (印字にキャラ限定なし) を
card 修正 (挙動不変: 工藤新一名の非キャラ=partner はリムーブエリア不可)。

**効果**: G1 match 1167→**1244** (+77 shipped が回帰 pin 化) / conflicts **0** / exceptions 9→**7**
(B03129/P・PR055 が N5 で match 昇格)。unit test +14 (positive/negative 対、mutate-safety)。
T2 2-lens 敵対 review (opus semantic + edge-test) 実施。

## unshipped unlock 実測 → P printing 2 枚出荷

conflict 解消による card 単位 unlock は **P printing 2 枚のみ** (`B07031P` 小泉紅子 SRP /
`B08049P` ジョディ RP — DEFERRED-INDEX 予告分)。≡base 決定表 probe green で emit (ALL_CARDS 1515)。
ヒラメキ sleep 10 枚は各々別の新規複雑文を持ち unlock ゼロ — 初版 ROI 根拠の「10+5+4 枚」は
行 unlock と card unlock の混同と判明 (spec 訂正済)。

## B3-3: exceptions 9 + align-ambiguous 2 — 全て benign (誤訳ゼロ)

opus workflow 7 agent (印字全列⇔DSL per-card 突合、敵対 verify 付き) → **7/7 家系 FULL_CORRECT**:
B03129/P・PR055 (disguise+cutin 多能力構造) / B05024/P・B08044/P・D09027 (shared factory closure) /
D04004 (grantKeywords closure) / B09041/P (合成 helper ability = align 曖昧の根因)。
現 exceptions 7 (closure 系 5 + B05030 配列順 drift) = **恒久 exception 枠**として裁定記録。

## gate

tsc 0 / vitest **3628+1skip** (3614→ +14) / smoke:1000 **winsA=498 不変** (timeouts=0, exceptions=0) /
8 lint errors=0 / eslint 0 / G1 mismatch=0 pin 維持。
