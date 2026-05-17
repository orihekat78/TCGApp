# Phase 5 Advance Guardrails

Phase 5 (2026-05-12〜14) で構築した infrastructure と Phase 8 実装の橋渡し漏れが
Phase 9-B で 4 件の engine バグとして顕在化した。
Phase 5 advance (Misread / Souza / SceneSwitch / Hirameki 本格統合) を進める前に、
構造的見落としを防ぐ 4 つのガードレールを正式化する。

## Context

| バグ | 漏れた観点 | 改修コミット |
|---|---|---|
| B1 clearNamed | listener hook 対象 (turn-end) 漏れ | `8490fd0` |
| B2 handUseCard char deploy | `mutate.scene.enter` 統合点漏れ | `7b9984d` |
| B3 AI cost picker 空 | `ability-ctx` の `ctx.dyn` 未設定 | `7b9984d` |
| B4 Heuristic NextHint gate | engine 変更が AI policy に波及せず | `a0d4c1c` |

詳細: [../sessions/2026-05-17-2.md](../sessions/2026-05-17-2.md)

## Guardrail 1: ルール行単位チェックリスト

[../rules/INDEX.md](../rules/INDEX.md) 該当ファイルを **1 行ずつ** スキャンし、
各規則テキストに対して以下 4 列を埋めた表を spec / PR description に必ず含める。

| ルール行 | engine hook | mutate target | listener test |
|---|---|---|---|
| (例)「相手が推理したとき」 | `reasoning:start` | `flags.misreadActive` | `on-reasoning-misread.test.ts` |
| (例) スタン特殊挙動 | `effect.apply` | — | 既存 [rules/03](../rules/03-field-areas.md) 準拠 |

該当行が「out of scope」ならその理由を明示すること。推測でルールを補完しない。

## Guardrail 2: AI policy 同期 PR 運用

engine の **listener / mutate / hook** を追加または変更する PR は、
同一 commit 範囲に以下 3 ファイルの整合更新を必須とする:

- `src/engine/listeners/<keyword>.ts` (or 等価)
- `src/ai/policy.ts` — heuristic 判定 / NextHint gate / scoring
- `src/ai/ability-ctx.ts` — `ctx.dyn` セットアップ / cost picker / choice resolution

**除外**: 純粋な内部最適化 (動作不変) / typo / コメント追加。
それ以外で AI 3 ファイルを触らないなら PR description で **why** を明示。

## Guardrail 3: smoke baseline + candidates dump

Phase 5 advance の各 commit 直後に以下を実行し、`.claude/reports/` に保存:

```pwsh
npm run smoke -- --verbose --games 100 > .claude/reports/smoke-<commit>-candidates.txt
```

move enumerator dump (deploy / reasoning / action / nextHint 候補数) を
**baseline と diff** することで「候補が消えた / 過剰に増えた」を即座に検知。
1000 戦は週次、`--games 100` は commit 毎の運用。

## Guardrail 4: listener 追加テンプレート

新規 listener / 共通クラスを追加する際、ファイル冒頭に以下を必須:

```typescript
// rules: rules/13-keywords.md §ミスリード
// Hooks: [reasoning:start, reasoning:end]
// Mutate targets: [flags.misreadActive, scene.lp(uid)]
// AI integration: [ability-ctx ctx.dyn setup, policy.choose for self-stun]
// Edge cases:
//   - hand0 / deck0 (reasoning still allowed)
//   - LP<=0 → reasoning gets 0 evidence (rules/11)
//   - simultaneous: multiple misread holders → all activate, resolution = owner pick
//   - 名乗り state: misread holder may be 名乗り (rules/13 §名乗り例外)
//   - 変装 中: misread effect 引継ぎ (rules/09)
```

test 雛形 (`tests/listeners/<keyword>.test.ts`) も同時作成し、上記 edge cases
5 項目を独立した `it()` で網羅する。上記例は Misread 特化のため、カード毎に
[CLAUDE.md §設計レビュー §2](../CLAUDE.md) の 5 区画 (0枚 / 不可逆操作 / 状態相互作用 /
数値マイナス / 複合連鎖) と対応する Edge cases に置き換えること。

## Self-check (CLAUDE.md §設計レビュー必須チェックリスト)

- [x] **ルール網羅性**: rules/13 (Misread/Souza), rules/20 (SceneSwitch), rules/10 (Hirameki) を G1 対象として明示
- [x] **エッジケース 5 件**: G4 テンプレで hand0 / LP≤0 / simultaneous / 名乗り / 変装 を強制
- [x] **水平展開**: 9-B 全 4 件に対応 (B1→G1+G4, B2→G4 主+G1 補 (`mutate target` 列で scene.enter 必須化), B3→G2, B4→G2+G3)
- [x] **状態完備性**: G4 `Mutate targets` 区画で GameState フィールド更新点を明示

## 関連

- [../sessions/2026-05-17-2.md](../sessions/2026-05-17-2.md) — Phase 9-A〜9-E + 9-B 4 件詳細
- [../CLAUDE.md](../CLAUDE.md) — 骨格凍結原則 / 設計レビュー手順
- [engine-api-events.md](engine-api-events.md) — listener hook 一覧
- [engine-api-cost.md](engine-api-cost.md) — cost picker 設計
- [engine-api-edge-cases.md](engine-api-edge-cases.md) — エッジケース API 挙動
