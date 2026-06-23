# engine: MR partner-area 構造 設計 (design-first, 2026-06-23, 敵対review反映 v2)

rules/18 MR能力①② を配線する additive engine 拡張設計。**実装は別 session**。
cohort/yield 表 = [engine-mr-partner-area-cohort.md](engine-mr-partner-area-cohort.md)。
3-lens 敵対 review (regression/rules/completeness) を反映済 (BLOCKER×3 + MAJOR fold-in)。

> ✅ **実装済 (engine/mr-partner-area-core, 2026-06-23, Phase 1 engine core)**。本設計から一部簡素化:
> ① MR②×switch は 3-caller 変更でなく **switchEnter self-correct** (freedSceneSlot) で実現 (非MR完全不変)。
> ② PA-MR reader は **read.scene.byUid に sentinel 解決を追加** (read.char.* が uniform に効く)。
> ③ **candidates.ts 未変更** (PA-MR targetability=未解決#3 DEFER)。④ **canDeclaredAbility に PA scope gate 追加**
> (on-scene 宣言は PA 不可)。⑤ 訂正: 既登録 MR 5枚で MR①② が **有効化** (「byte-identical/MR0枚」は誤、非MRのみ不変)。
> 4-lens 敵対review = REVISE (挙動バグ無)。残課題・暫定解は [BUG-154](../bugs/BUG-154.md) + cohort.md。

## 歩留まり (なぜやる)

- 残 MR 53 printings / **25 unique** (既出荷 vacuous 5 件除外後、cohort.md 検算節)。
- PA-slot 配線 + 下記 reader 拡張で完全実装到達 = **15 unique** (review で 18→15 に下方修正: B05005/B09002/B09110 は別 gate 併発で demote)。
- 残 10 は別 gate 併発。MR は残る最大の単一メカニクス。未配線が B07079/B08032/B09054 等の句を vacuous 出荷させている (DEFERRED L84)。

## 中核不変条件 (load-bearing)

partner は strict singleton (`PlayerState.partner`、[game-state.ts:7](../../src/engine/types/game-state.ts))。全 consumer が直読み or sentinel uid `partner:self/opp` 経由で参照。

- **新規 optional slot を足す。`partner` は絶対に上書きしない** → `partnerAreaMR?: SceneCharacter | null` (player 毎)。`SceneCharacter` は既に `declaredUseCount` を持つので PA-MR の【ターン①】カウントはこの slot object に載る。
- MR② により MR は player 毎 **常に ≤1** → 単一 optional で十分。real partner と PA-MR は共存可 (rules/03:8、PA 枚数上限なし)。
- dead stub `mutate/partner.ts` の `toPartnerAreaFromScene`(L97)/`toRemovedByMR`(L87) は real partner を破壊上書き (grep 0 caller) → **置換**する (real-partner 上書き挙動を使うコードは現存ゼロ)。

## MR能力① (相手ターン中の現場離脱 → PA 移動)

rules/18:14-23。**owner ≠ turn.player のときのみ**。**離脱方法不問** (リムーブ/移動/効果)。「代わりに」ではない → **leave トリガは発火**。

- 共有 helper `redirectMrToPA(s, leavingChar, owner)` を **全 scene-leave primitive** に挿す:
  `removeToRemove`([scene.ts:160](../../src/engine/mutate/scene.ts), emit **直後**) / `toDeck`(:210) / `toDeckBottom`(:191) / `toHand`(:244)。turn-relative gate + isMR 判定。
- **⚠ 単一ゾーン不変**: `removeToRemove` は L158 で `remove.push(char.cardId)` 済 → PA redirect 時は **その cardId を `remove` から splice**して slot へ移す (二重在席=refresh shuffle 二重計上バグ防止)。set/重ねカードも同伴。
- state(stun/sleep) は snapshot 引き継ぎ。

## MR能力② (現場に MR 登場 → 既存 MR をリムーブ)

rules/18:25-33。同名不問。既存 MR が現場 or PA どちらでも対象。

- **cause は `'effect'`** ([scene.ts:10](../../src/engine/mutate/scene.ts) RemoveCause union に `'ability'` は無い)。`'effect'` で 【現場リムーブ時】発火、ヒラメキ不可 (rules/10、action[event] 専用)。
- scope = **登場プレイヤー (`enterP`)**、literal `'self'` 禁止 (CPU-vs-CPU は両側 enter)。`players[enterP].scene` + `players[enterP].partnerAreaMR` の既存 MR を除去。
- **5枚上限 throw 回避は caller 層で**: switch-vs-enter 判定は caller がやる (`atom-handlers/scene.ts:55` full 計算 / `hand-use-card.ts` / `next-hint.ts`)。enter primitive 内で除去すると switchEnter と二重除去 → **MR② を先に走らせ fullness を再計算**してから switch/enter 分岐。

## PA-MR キャラの能力

rules/18:35-39 + rules/21:10。**推理/アクション不可** (partner sentinel uid 不到達 ∴ 自動除外)。**宣言能力 / on-partner-area 発動能力は使える**。

- spine 変更 (triggered/declared 系): [triggered.ts:120-140](../../src/engine/listeners/triggered.ts) `collectCardsInPlay` に PA-MR を **別 uid `partnerMR:self/opp` + area 'partner-area'** で登録。scope gate(L149)は既に MR 対応。
- **continuous 系も別 reader**: [read/char.ts:56](../../src/engine/read/char.ts) `auraDelta`/`keywords`/`restrictsOpponent` は **scene のみ走査** → PA-MR slot も走査 (scope on-partner-area 時)。`collectCardsInPlay` だけでは continuous は拾えない (B08062「パートナーエリアでも有効」)。
- 宣言能力: [declared-ability.ts:38-56](../../src/engine/flow/main/declared-ability.ts) `findCardOnBoard` に `partnerMR:` 解決。【ターン①】= [flag.ts](../../src/engine/mutate/flag.ts) `incrDeclaredUseCount`(L37) + `resetTurnFlags`(L79) + [read/char.ts:290](../../src/engine/read/char.ts) `declaredUseCount` に `partnerMR:` 分岐 (slot object の declaredUseCount を読み書き)。**これ無しだと once-per-game 化**。

## rules/19 整合

「元の能力を無効にする」でも MR①② は無効化されない (rules/19:55)。MR semantics は per-card ability list の外。

## 変更ファイル一覧 (additive)

| # | file | 変更 |
|---|------|------|
| 1 | types/game-state.ts | `partnerAreaMR?: SceneCharacter\|null` 追加。partnerExists invariant は要求しない |
| 2 | mutate/partner.ts:87,97 | dead stub 2本を PA-MR slot 対象へ書換 (real partner 上書き廃止) |
| 3 | mutate/scene.ts | MR① helper を removeToRemove/toDeck/toDeckBottom/toHand に挿入 (remove splice 含む) |
| 4 | mutate/scene.ts:42-85 + caller (atom-handlers/scene.ts, hand-use-card.ts, next-hint.ts) | MR② enter-removal cause:'effect'、caller 層で fullness 再計算 |
| 5 | listeners/triggered.ts:120-140 | collectCardsInPlay に PA-MR (uid `partnerMR:`) — triggered/declared spine |
| 6 | read/char.ts:56,290 | auraDelta/keywords/restrictsOpponent + declaredUseCount に PA-MR 走査 |
| 7 | mutate/flag.ts:37,79 | incrDeclaredUseCount + resetTurnFlags に partnerMR 分岐 |
| 8 | flow/auto-phase.ts:46-56 | PA-MR 活性化分岐。**stun→sleep は slot に bespoke 実装** (setState helper は slot 非対応) |
| 9 | flow/main/declared-ability.ts:38-56 | `partnerMR:` uid 解決 |
| 10 | card-def.ts:142 / loader | isMR を **`rarity.startsWith('MR')`** から消費 (MR/MRP/MRCP 全 printing、現 0 cards) |

real partner path (canWin [read/game.ts:18](../../src/engine/read/game.ts)/assist/reasoning/partnerColor [cond/eval.ts:39](../../src/engine/cond/eval.ts)/candidates partner-area [candidates.ts:135](../../src/engine/target/candidates.ts)) は別 slot ゆえ干渉ゼロ。

## 回帰アイソレーション

- 新 slot default 不在 → setup/state-factory/partnerExists 不変。
- collectCardsInPlay の PA-MR uid は `partner:`+p と別文字列 (double-fire 防止)。
- UI: PartnerArea/usePartner/Playmat は単一 partner 前提 → 第2占有の render+選択 path 追加 (soft spot、Phase 2)。

## フェーズ分割 (実装 session 推奨)

1. **engine core** (headless TDD): slot + MR①② (全 leave verb + caller fullness) + collectCardsInPlay + read/char PA-MR 走査 + flag declaredUseCount + decoy test。挙動不変ゲート。
2. **UI**: PartnerArea/usePartner/Playmat に PA-MR render+選択。
3. **AI**: move-enumerator に PA-MR 宣言能力列挙 ([move-enumerator.ts:78](../../src/ai/move-enumerator.ts))。
4. **card wave**: SOLE 15 を per-card grounding→敵対verify→出荷 (cohort は planning 見積、最終 gating は wave 時)。

## 未解決 (要公式Q&A or ユーザー裁定 — 推測で埋めない、暫定保守解+provisional コメント+DEFER 起票)

1. MR① 中間状態順序: 【現場リムーブ時】が card を動かす場合 MR を remove-area で見るか PA で見るか + refresh 計上 (rules/18:20-22 + 14)。
2. MR② が **PA 常駐 MR** をリムーブする場合の分類 (rules/18:33 は scene のみ「能力によるリムーブ」)。
3. PA-MR の相手 targetability / MR 枚数列挙 ([candidates.ts:135](../../src/engine/target/candidates.ts) 現 real partner 1体のみ)。
4. **MR②×switch 順序**: MR② が slot を空けた後は scene 非満杯 → switch 抑制すべき (rules/20 switch は満杯時のみ)。fullness を MR② 後に評価。
