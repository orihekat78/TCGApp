# engine 拡張 2 レーン並行体制 (2026-07-02 ユーザー承認)

拡張期 (~50 gate 残) を **A1 (structural) / A2 (additive)** の 2 並行 session で圧縮する。
根拠 driver: [engine-extension-plan-2026-06-30.tsv](engine-extension-plan-2026-06-30.tsv) の batch 列 +
[compiler-demand-signal-2026-07-02.md](compiler-demand-signal-2026-07-02.md) 再採寸。
session prompt: A1 = [NEXT-SESSION-PROMPT.md](../NEXT-SESSION-PROMPT.md) /
A2 = [NEXT-SESSION-PROMPT-TRACK-A2.md](../NEXT-SESSION-PROMPT-TRACK-A2.md) / B = steady-state 監査 (併走可)。

## Lane 割当 (batch 単位)

| lane | batch | 性質 |
| --- | --- | --- |
| **A1 (structural)** | datamodel-scope-mr 残 (G39 PA 移動+計数) / trigger-observer-hooks 残 / G34 multi-select / batch-souza-deckreveal-costremove / batch-leave-remove-disguise-hooks / keyword-trait-turn-tracking-grant / rule-rewrite-altwin-delay (**最後**) / 各 batch 内の [S] 行全部 | hook 新設・resolver/UI・GameState 形状。1 wave 1-2 個、T2/T3 review |
| **A2 (additive)** | condition-dyn-absent-group / verbs-effects / restriction-flags / relative-filter-revealed-color / setcard-stack-subsystem — **いずれも [A] additive 行のみ** | 評価器/dyn/verb/flag の純追加。1 wave 3-8 個、T1-T2 |

batch 内 [S] (structural) 行は A2 が触らず **DEFERRED-INDEX 経由で A1 へ送る** (逆も同様)。

## 排他ファイルマップ

| 領域 | A1 | A2 |
| --- | --- | --- |
| `src/engine/listeners/**` (hook 新設) / `src/engine/flow/**` / resolver core (`resolve-picks.ts` 構造変更) | ✅ | ❌ |
| GameState 形状 (`src/engine/state/**` 型追加) / `mutate/partner.ts` / UI (`src/ui/**`) | ✅ | ❌ |
| `src/engine/cond/eval.ts` (Condition 評価器追加) / dyn 評価器 / TargetFilter 軸 (candidates + read 系の既存 honor site 追記) | ❌ | ✅ |
| `src/engine/effect/atom-handlers/**` (verb 純追加) / turn-flag 系 (eventUseBanned mirror template) | ❌ | ✅ |
| cost union 追加 (canPay/pay/UI costToText/validate-specs 多点) | ✅ (T2 扱い) | ❌ |
| **共有 (append-only、rebase 機械解決)**: `card-def.ts` 型 union 追記 / `src/cards/**` (exemplar) / `tests/cards/**` / auto-docs / CHANGELOG entries / registry barrel | ✅ | ✅ |

判断に迷う挿入面 = structural とみなし A1 (保守側に倒す)。

## push protocol (直列 FF、実績プロセス流用)

1. 両 lane とも `git worktree add -b engine/<lane>-<n> /c/tmp/<dir> origin/main` + node_modules junction (npm install 禁止)。
2. push は **先着 FF**。後発は `git fetch → git rebase origin/main → 全ゲート再走 (tsc/vitest/smoke:1000/8lint) → push origin HEAD:main`。
   **rebase 後のゲート再走は省略禁止** (個別 green の和 ≠ 合成 green。smoke winsA=498 で合成挙動を確認)。
3. auto-docs 衝突は rebase 後 `npm run docs` 再生成で機械解決。docs は自 commit に含める (CI は docs:check 除外)。
4. 出荷後に Track B `npm run cards:sync` (G1 pin) が誤訳/conflict を自動監査 — 両 lane とも exemplar 同梱原則を維持。

## review 衝突回避 (server rate-limit 対策)

- 重い opus workflow (4-lens panel) を **2 lane 同時起動しない**。A2 は T1 中心 = 機械ゲート+probe で review 自体が軽く、自然に回避。
- 各 workflow は SUB≤5 ([[feedback-workflow-concurrency-throttle]])。
- reviewer には worktree 絶対パス明示 + `git -C` 裏取り強制 ([[feedback-workflow-review-reads-cwd-not-worktree]])。

## 着手前の共通義務 (両 lane)

- `git ls-remote origin main` で HEAD 確認 → 対象 primitive を **origin/main 基準で semantic grep** (stale-DEFER 排除。
  plan TSV は 06-30 snapshot で既に一部出荷済み — 「未実装」表記を信用しない)。
- TDD probe (RED→GREEN) + exemplar カード同梱。tier は speed-rebalance 表に従う。
- 「N枚 pick」を含む場合は 4 層検証 (engine 3 経路 + playwright UI、BUG-165 教訓)。

## 完了条件

全 batch 消化 = 拡張期終了 → カード量産フェーズ (辞書バッチ + T1/T2 著述 lane) へ移行。
