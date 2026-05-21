# 作業ログ — 名探偵コナンTCG プロジェクト

## 2026-05-21 セッション 10 (BUG-037 CSS animation fill-mode 修正)

- user_request #1 / #16 (重複): scene card が sleep にならない
- 原因: `SceneArea.css:128` `animation: scene-card-enter ... both;` の `forwards` 側が transform を lock
- 修正: fill-mode `both` → `backwards` の 1 行
- 検証: typecheck / 1511 unit / 38+1 E2E / 1000-game smoke 0 errors
- 新規 spec: `tests/e2e/bug-037.spec.ts` (sleep + stun computed transform を assert)
- セッション詳細: `.claude/sessions/2026-05-21-10.md`
- commit: `9567c0c` (BUG-037 修正) / `cdaa5f7` (hash 反映)

## 2026-05-21 セッション 11 (Phase α — user_request triage)

- plan 作成: `C:\Users\arumi\.claude\plans\shimmying-dancing-hippo.md`
- 公式 PDF p.12-13 を WebFetch + Read で直接確認:
  - #5 解決編移行は **必ず移行 (移行させないことはできません)** ← 仕様通り
  - #6/#14 NH は **権利が増え、後で使えるわけではありません** ← 仕様通り
- Phase α 4 件:
  - `.claude/CLAUDE.md` — 「効率より精度」方針追加 (#2)
  - `.claude/docs/user-request-clarifications.md` 新規 (#5/#6/#14)
  - `.claude/specs/DEFERRED-INDEX.md` 新規 (#11)
  - `.claude/bugs/README.md` 新規 (#10)
- 関連 memory: `feedback_accuracy_over_speed`, `feedback_rule_rebuttal_pattern`

## 2026-05-22 セッション 12 (Phase β #7 #15 — BUG-038 close + BUG-040 fix)

- BUG-038 (#7 sleep target): Playwright headed で再現せず → 仕様外 close (BUG-037 で間接解決) `152253d`
- BUG-040 (#15 declared ability): `Playmat.tsx:382` で `declaredTargetCount={0}` ハードコーディング → メニュー常時 disabled
  - 修正: `enumDeclaredAbilitySources(state, 'self').length` を計算
  - Playwright headed: source picker → ability auto-select → 発動 → sleepSelf cost paid + log に declaredAbility 記録
  - unit 1511 + E2E 40 PASS

## 2026-05-22 セッション 13 (Phase β #13 — BUG-041 fix)

- BUG-041 (#13 登場時効果カードが手札から出せない): scene 5 枚時の switch 経路が UI から呼べなかった
  - 原因: `Playmat.tsx:367` `canUse` が `canHandUseCard` のみで判定、`canHandUseCardSwitch` 未評価
  - 副因: `handUseReason.ts:78` で問答無用 reject メッセージ → null に変更
  - 修正: 4 行 + 1 ブロック差分。BUG-040 と同 pattern「engine + flow 完成、Playmat 配線漏れ」
  - Playwright headed: scene 5 枚 → level≤FILE のキャラ click → switch picker (ssp-overlay) → 退場 + 登場確認
  - unit 1511 + E2E 40 PASS

## 2026-05-22 セッション 14 (Phase β #17 — BUG-042 fix)

- BUG-042 (#17 デッキ選択 UI): self=CT-D08 / opp=CT-D11 がハードコーディング → 選択 UI 配備
  - 修正: `deckBuilder.ts` に `DeckId` 型 + `AVAILABLE_DECKS` + `buildDeckPair({selfDeckId, oppDeckId})` 新 API
  - `gameStarter.ts:performGameStart` に optional 第二引数 `deckSelection` 追加
  - `GameSetupModal.tsx` に 2 つの `<select>` (data-testid: game-setup-self-deck / game-setup-opp-deck)
  - CSS スタイル追加 (`.game-setup-deck-select`)
  - Playwright headed: swap (self=D11, opp=D08) → mulligan に D11 カード出現 → engine state で case/partner 検証 ✓
  - unit 1511 + E2E 40 PASS

## 2026-05-22 セッション 15 (Phase β #8 — BUG-043 fix)

- BUG-043 (#8 手札カード個別拡大表示): HandZone は zone 折畳/展開しかなく、CardExpandModal の trigger 無し
  - 修正: HandZone の HandMiniCard / HandCard 両方に `onContextMenu` 追加 (右クリック → onExpand 呼出)
  - HandZoneProps に `onCardExpand` (zone 展開と区別する prop 名) 追加
  - Playmat.tsx で `onCardExpand={expandModal.open}` 配線
  - Playwright headed: collapsed mini-card / expanded hand-card 両方で右クリック → CardExpandModal 開く ✓
  - 「Playmat.tsx 配線漏れ」pattern 4 件目 (BUG-040/041/042/043)
  - unit 1511 + E2E 40 PASS

## 2026-05-22 セッション 16 (Phase β #4 — BUG-044 fix)

- BUG-044 (#4 AI が事件アクションしない): heuristic で reasoning が常に優先固定 → case attack 不発
  - 修正: reasoning vs actionAgainstCase をスコア比較、後期 (opp evidence ≥ req-1 ∧ self 劣勢) で case attack 優先
  - threshold 4 回試行錯誤: 135.5→94.8→53.4→11.19 turn (timeouts 641→424→208→**0**)
  - 採用 threshold: oppEvidence ≥ req-1 ∧ selfEvidence < oppEvidence (劣勢時 disruption のみ)
  - smoke: avg 11.19 / timeouts 0 / wins 500-500 均衡
  - BUG-042 副作用で 3 マッチアップ smoke が自動テスト化された
  - AI 116 unit + 1511 全 unit + 40 E2E PASS
