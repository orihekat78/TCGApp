## タスク B: text-faithfulness 監査 横展開 — BUG-122 (icon-keyword) + BUG-123 (kind:character) 検出・修正

**Round/Phase**: 2026-06-06 session — 推奨作業順 B→E→C→A→D の B。catalog-reuse + ct-p01〜p09 の既存実装 (~280 枚) を多エージェント並列監査 + engine フィルタ評価経路の全数突合。

### engine フィルタ評価経路の監査 (claude 直接)

TargetFilter を解釈する全経路を列挙し正準 (matchOneFilter) と突合:

- **matchOneFilter** (candidates.ts, 正準・pick 候補列挙の 9 割) — 全 field 評価で健全。
- **targetFilterToPredicate** (deckRevealUntil) — 登録カードは color/level/kind のみ使用 → active バグ無し
  (cardName/keyword は latent gap、タスク A の deckReveal-by-cardName カードで要ハードニング)。
- **boundMatchesFilter** (cond/eval) — D11014 の cardName のみ → 安全。
- **eventRemoveByAP** (shared) は canonical 経由、**applyPreTargetExpansion** は専用 atom schema → 問題なし。

### BUG-122 (engine, 中) — filter.keyword がアイコン能力を未検出

カットイン/変装/ヒラメキ/ミスリードは `keywords[]` でなく ability 構造で表現されるのに matchOneFilter は
keywords[] のみ参照 → `filter.keyword:'カットイン'` が永久不一致。**B05112** a1「【カットイン】を持つ
レベル5以下の【黒】のキャラを登場」が候補0で機能不全 (BUG-117/118 と同型の field-drop)。

- 新規 `src/engine/read/keyword.ts` に `defHasKeyword` (keywords[] + アイコン能力 ability 検出の単一の真実源)。
- matchOneFilter の keyword 判定を `defHasKeyword` 経由に。`contact.ts isCutInCard` も同述語に一元化 (ドリフト排除)。
- 検証: candidates.test (カットイン ability 一致 / 迅速 keywords[] 不変) + keyword.test (全 4 アイコン) +
  e2e `bug-122-cutin-keyword-filter.spec.ts` (B05112 宣言能力で B05110 のみ候補、Lv8/緑非カットインは除外)。

### BUG-123 (card, 低) — イベント含みエリアの「キャラ」pick で kind:'character' 欠落

remove/hand から「キャラ」を選ぶ pick が `color`(±`levelMax`) のみで `kind:'character'` を欠き、同色イベントが
誤候補化。**B01094**(+P spread)/**B09044 a1·a2** の 3 ability に `kind:'character'` 追加。多エージェント監査は
B09044 a2 のみ検出、a1/B01094 は claude の色フィルタ水平展開 (全 35 箇所突合) で追加検出。trait/cardName filter
併用カードは events traits:[] で本質的に安全と確認。

### 多エージェント監査結果 (7 並列, report-only)

REVIEWED 358 枚 / 確定バグ 2 系統 (B05112=BUG-122, B09044 a2=BUG-123)。
side/count/scope/chooser/condition は全 faithful、他の icon-keyword trap 0 件。

### 検証

- typecheck clean / 全 vitest **1799 pass / 1 skip / 0 fail** (+11、回帰 0) / 新 e2e 1 pass /
  lint (side-channel/listener/eslint errors=0、bugs errors=0)。
- 規約: card-addition-checklist §7 に「アイコン能力 filter」「エリア × kind」項目 + LESSONS-LEARNED-3 教訓 26。

### ALL_CARDS

933 枚 (不変 — バグ修正のみ、カード追加なし)。
