---
name: engine-wave
description: Use when executing an engine extension wave (Track A1 structural / Track A2 additive lane) — primitive 追加、exemplar 同梱、TDD probe、敵対 review、FF push を行う engine 拡張セッション。subagent の model (opus/sonnet/fable) や effort の選択判断が要るとき。
---

# engine-wave — engine 拡張 wave 実行 + model/effort オーケストレーション

## 手順 driver (重複記載しない — 必ず開く)

- lane 定義・排他ファイルマップ・push protocol: [specs/engine-parallel-2lane-2026-07-02.md](../../specs/engine-parallel-2lane-2026-07-02.md)
- queue: A1 = [NEXT-SESSION-PROMPT.md](../../NEXT-SESSION-PROMPT.md) / A2 = [NEXT-SESSION-PROMPT-TRACK-A2.md](../../NEXT-SESSION-PROMPT-TRACK-A2.md)
- tier 判定 (T1/T2/T3): [specs/speed-rebalance-2026-07-02.md](../../specs/speed-rebalance-2026-07-02.md)

wave 骨子: `ls-remote` → 対象 primitive を origin/main semantic grep (stale 排除) → worktree + junction →
TDD probe RED→GREEN → exemplar カード同梱 → 6 ゲート → tier 相応 review → FF push → CHANGELOG/prompt/memory 更新。

## モデル・オーケストレーション (2026-07-02 ユーザー指示)

**基本 = opus。単純作業 = sonnet。opus で担えない難判断 = fable に escalate。**
fable の agent 可用性は 2026-07-02 に実測 OK (Agent tool / Workflow とも `model:'fable'`)。
「model not available」が再発した場合のみ CLAUDE.md 2026-06-14 手順 (opus multi-vote 代替) に一時復帰。

| 作業 | model | 判断基準 |
| --- | --- | --- |
| オーケストレーション / 実装 / 通常判断 / grounding | opus | default。迷ったら opus |
| grep 集合一致・diff 機械突合・whitelist 抽出・lint/テスト実走 lens・dump 収集 | sonnet | 出力が機械検証可能な作業のみ |
| ルール裁定の解釈 / カードテキスト⇔DSL 意味等価の**最終**判定 / T3 (hot-path・骨格・MR) の最終 verify / opus lens が割れた時 (CLEAN vs BLOCK) の裁定 | fable | opus 2 lens で確信が持てない・矛盾した時に escalate。先に fable を使わない (レイテンシ/コスト) |

**escalate 条件の具体形**: ① 敵対 review で lens 判定が分裂 ② 公式ルール文言の解釈が 2 通り成立
③ 「同文言・異DSL」G1 conflict の裁定 ④ E3 (勝敗系 rewrite) の semantic verify。

## effort 自動選択 (Workflow `agent()` opts.effort)

| tier / 作業 | effort |
| --- | --- |
| 機械 lens (sonnet 系全部)・collect・dump | `low` |
| 実装 agent・T1/T2 semantic lens | 省略 (session 継承 = medium 相当) |
| 敵対 verify・edge-test lens・rebase 後合成確認 | `high` |
| fable escalate 裁定・T3 最終 verify | `xhigh` |

```js
// Workflow 内の典型形
agent(implPrompt, { model: 'opus', phase: 'Impl' })                                  // 実装
agent(lintPrompt, { model: 'sonnet', effort: 'low', phase: 'Gate' })                 // 機械 lens
agent(refutePrompt, { model: 'opus', effort: 'high', phase: 'Verify' })              // 敵対反証
agent(adjudicatePrompt, { model: 'fable', effort: 'xhigh', phase: 'Adjudicate' })    // 割れた時のみ
```

## throttle / 並行制約

- 重い review workflow は A1/A2 で**同時起動しない**。各 workflow SUB≤5。
- reviewer には worktree **絶対パス明示 + `git -C` 裏取り強制** (cwd grep で誤 block する前科)。
- fable escalate は 1 wave 数回まで (乱発しない — escalate が常態化するなら tier 判定が誤り)。

## よくある間違い

- TSV/prompt の「未実装」を信じて grep せず着手 → 出荷済と衝突。**semantic grep が先**。
- sonnet に意味判断をさせる (「この 2 つの DSL は等価か」等) → 禁止。sonnet は機械検証可能な作業のみ。
- fable を最初から使う → opus で足りる作業に高コスト。escalate 条件を満たしてから。
- effort `max` の常用 → xhigh で十分。max は使わない (根拠が要るなら spec 化してから)。
