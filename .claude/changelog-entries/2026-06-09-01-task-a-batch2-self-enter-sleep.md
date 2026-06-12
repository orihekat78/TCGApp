## Task A batch#2 着手 — 自己「スリープ状態で登場」パターン確立 (B01011 江戸川コナン)

**Round/Phase**: 2026-06-09 session — engine変更0 カードバッチ (Task A) batch#2 の 1 枚目。

Task A 再分類サーベイ (`catalog-survey-2026-06-06/`) の green候補から、`batch2-green-shortlist.md`
A.enter+hirameki クラスタの代表として **B01011 江戸川コナン** を実装。**engine 不変** (touched: cards/ + _reuse/index.ts + tests のみ)。

### 確立したパターン: 自己「スリープ状態で登場」(engine変更0)
- 公式テキスト「このキャラはスリープ状態で登場する。」を、`enter` (selfOnly) トリガ →
  `sceneSetState{ uid:'$self', state:'sleep' }` で表現 (D03011/D11016/B01028 a3 の `uid:'$self'` state変更パターンの sleep 版)。
- `enter` hook は通常プレイ (handUseCard) / ネクストヒント / 効果登場 (sceneEnter) の **全経路で emit** されるため、
  公式 Q&A「能力や効果によって登場する場合でもスリープ状態で登場しますか？→はい」を 1 つの selfOnly トリガで満たす。
- 新 verb・新 hook・engine 変更は不要 (既存 `sceneSetState` + 配線済 `enter` listener)。

### B01011 (青/Lv4/AP2000/LP2, 探偵・毛利探偵事務所・少年探偵団)
- a1: 「このキャラはスリープ状態で登場する。」 = enter(selfOnly) → self sleep。
- a2: 【ヒラメキ】カードを1枚引く (D08013 a2 同型)。
- 完全同型 (純粋自己スリープ登場 + ヒラメキdraw のみ) はカタログ上 B01011 のみ。他の「スリープ状態で登場」カード
  (B01050/B01052/D06016/B03120 等) は 【登場時】look-1 や 【宣言】が複合する別シグネチャ → 次以降の代表で扱う。

### 検証 (全グリーン / 回帰0)
- 新規機能テスト `tests/cards/enter-sleep-self-batch.test.ts`: handUseCard 実 flow で「現場にスリープ登場」を assert + def shape。
- full vitest **1876 pass / 1 skip / 0 fail** (前回 1874 + 新規2)、typecheck clean、eslint errors 0 (変更ファイル)、docs:check 同期。
- smoke:1000 **exceptions=0 / timeouts=0** (winsA=469/winsB=531)。Playwright e2e gate **115 pass / 1 skip / 0 fail**。
- ALL_CARDS: 982 枚。
