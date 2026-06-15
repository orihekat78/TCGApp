# engine gate triage (2026-06-15, cluster12/13 出荷後)

残 needs-design engine gate を per-card certify (opus assess→敵対 refute→synthesize) で実証選定。
**結論: ready-to-design な gate は無い。出荷可能な全 gate が needs-more-design (設計パスを1回挟めば実装可)。**
簡単な gate は cluster12/13 で出し切った。元データ: `.tmp/triage/gate-candidates.json` (決定論 enum) + workflow wf_73747c38-77b。

## ランキング (refute 補正値)

| gate | 真歩留まり (sole-gate) | cost | risk | 判定 | score |
|------|----------------------|------|------|------|-------|
| multi-card-sceneEnter | 4 | L | med | needs-more-design | 7.2 |
| partner-area-structure | 17 | XL | high | needs-more-design | 6.5 |
| mustGuard | 2 | L | med | needs-more-design | 2.1 |
| name-designation | 9 | XL | high | needs-more-design | 1.2 |
| auraGrant-triggered | 0 | — | — | avoid | 0 |
| loseGame | 0 | — | — | avoid | 0 |

## 各 gate の核心

### multi-card-sceneEnter (推奨, score 7.2) — 4枚: B09010/B09010P/PR042/PR046
「2枚まで選び登場」。単一登場+switch は配線済だが multi-pick cardIds branch と multi-victim switch が無い。
GameState 変更なし・win条件非介入・additive (cardIds 不在時は既存単一パス不変)。残課題は**機械的スコープ穴**:
(1) effectPickResolve に pickedUids+switchRemoveUids[] を運ぶ第5 union member、(2) 可変数 (N−room) switch victim
を apply-pick Pattern A / hasCardIdsBind 両方で処理、(3) AI greedy path が cardIds を branch 無し handler に渡す
+ distinctNames dedup 無し (B09010「それぞれカード名の異なる」違反)、(4) per-card emit で enterOrderThisTurn を
1枚ずつ加算 (疾風N、~209 enter-hook consumer)。→ 短い設計パスで穴を塞げば1クラスタでクリーン出荷可能。

### partner-area-structure (runner-up, score 6.5) — 17枚 (B07030/P〜PR269、18→17: B07049 は dual-area pick で compound)
最大歩留まり。PlayerState に partnerAreaCards collection 追加 (= GameState shape change、optional field default[]
で型 blast radius は限定)。ancillary 機構 (continuous AP-dyn D08005 / sceneEnter from hand|remove / 変装時 hook /
case:to-resolved+flipFaceUpEvidence cost / sceneHas cardName-OR) は全て実在。要設計判断3点: (a) dual-area pick の
query shape (B07049/B09039 a1 も解禁)、(b) PA stash を表す Candidate kind (現 'partner' kind は cardId 無し・
componentsForCandidate→[])、(c) removeFromPartnerArea cost channel whitelist + face-up PA picker UI。
+ collectCardsInPlay audit (現 single partner.cardId のみ scan) + smoke 再 bless。同構造で MR列挙 B09047 も将来解禁。
除外: B07035/P (deck-look filter 誤検出, disjunction-filter gate)、B09039 (effect-driven-event-use compound)。

### mustGuard (score 2.1) — 2枚: B09040/B09040P
歩留まり低 + 設計が3点 mis-scoped: char-SPECIFIC 強制 (「defender must guard」ではない)、opp-side picked-target
grant が前例ゼロ (BUG-120 controller/chooser class)、passGuard 強制の enforcement 位置が誤り。smoke 再 bless 必須
(BUG-144 前例)。B05005×3=next-hint-use reaction gap / B03041×2=set-card persistent grant + action-scoped 強制 で compound。

### name-designation (score 1.2) — 9枚
歩留まりは本物だが cost 抑制の2本柱が refute で崩壊: (1) ctx.dyn は suspend/resume (entryToCtx) で**落ちる**ので
designation の保持には frozen 解決コア (stack.ts/effect-stack.ts) 改変が要る、(2) cluster12 nested-filter-dyn は
deckRevealUntil の filter に**届かない** (新 substitution path 必要)。+ 新 UI modal + all-names enumerator +
AI hidden-info branch + pending-pick side-channel。under-scoped frozen-core 侵入 (loseGame/enter-source の轍)。
sole-gate 9 (B01095/B09003/P/B09108/P/B09111/P/B09112/P)、6 compound (B04048/P=draw-until-N、B09052/P+PR099/PR105=name-rewrite verb)。

### auraGrant-triggered (avoid) / loseGame (avoid) — 共に真歩留まり 0
- auraGrant-triggered: 唯一の候補 B08091 は regex 誤検出 (現場リムーブ時 は target filter で対応済)。真の blocker は
  無関係な evidence face-up→face-down flip verb。真の例 B09024 は候補に不在。
- loseGame: 17枚全て compound。15枚はパートナー【事件解決】能力 書換 (win条件ハードワイヤ canWin/solveCase 改変=XL/骨格凍結違反)
  + 証拠隠滅 keyword + dyn discardEvidence cost。B09107/P は evidence-trait-count condition 等。bare verb は ship 0。
