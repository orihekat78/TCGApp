## BUG-117 修正 — deckRevealUntil の ap/lp filter 黙殺 (engine バグ修正)

**Round/Phase**: 2026-06-05 session — deck-look-N batch #4/#5 の Playwright text-faithfulness 検証

### 背景

deck-look-N (batch #4/#5) で追加したカードが「UI 上でテキスト通りに動くか」を
Playwright で実機検証したところ、**B01013「LP0の青」/ B01053「LP2以上の白」** が
LP 条件を無視して「最初の色一致キャラ」を拾う不具合を検出。

### 原因

`atom-handlers.ts` の `targetFilterToPredicate` (deckRevealUntil 専用の
TargetFilter→predicate 変換) が `apMin/apMax/lpMin/lpMax` を **未実装で黙って drop**。
型 (TargetFilter) には在るため typecheck を通過していた。正路 (candidates.ts
`matchOneFilter`) は ap/lp 実装済 → 経路で実装が乖離していた。

### 修正 (engine バグ修正 / additive)

- `targetFilterToPredicate` に ap/lp 判定を追加 (printed 値 `d.ap/d.lp ?? 0`、
  matchOneFilter の非現場ケースと同式)。color/level 系の既存挙動は不変。
- 影響カードは B01013 / B01013P / B01053 の 3 枚のみ (水平展開で全 22 live カード確認)。
- `targetFilterToPredicate` 以外に TargetFilter を縮小実装する箇所は engine 内に無いことを確認。

### 検証

- **Playwright**: `tests/e2e/bug-117-deckreveal-lp-filter.spec.ts` 新規 2 case
  (B01013 LP0青 / B01053 LP2以上白)。修正前 fail → 修正後 pass を実機確認。
- 既存 deck-look-N e2e 23 件 (engine-extensions / reuse-cards / deck-reveal-overlay) 回帰 0。
- typecheck clean / lint 全 errors=0。
- 全 vitest: bug-077 のみ pre-existing flaky timeout (本環境の registerAll import 負荷、
  変更退避ベースラインでも同様に再現 = 本修正と無関係)。

### 教訓

型に field が在ること ≠ engine が評価すること。declarative filter を新 verb で受ける際は
**どの field を実機で評価するか** を確認する (card-impl-engine-gates.md の同型教訓)。
deck-look 系 e2e は「条件外の decoy を上位に置いて拾わせない」形を必須とする。

### engine 行数

`targetFilterToPredicate` に 6 行追加 (ap/lp 判定)。骨格凍結原則の例外「骨格自体のバグ修正」に該当。
