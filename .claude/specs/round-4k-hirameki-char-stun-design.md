---
name: round-4k-hirameki-char-stun-design
date: 2026-05-20
round: 4k
status: design
related:
  - .claude/specs/shared-classes/hiramekiCharStun.md
  - tests/e2e/patterns/hirameki-draw.spec.ts
  - .claude/bugs/BUG-035.md
---

# Round 4k — hiramekiCharStun E2E spec 設計

## 対象カード
- **D08019 a2 (character / 阿笠博士 / 青 Lv5)**: `hiramekiCharStun({ side:'either', abilityId:'a2' })`
- **D11009 a3 (character / 萩原研二 / 黄 Lv7)**: `hiramekiCharStun({ side:'either', abilityId:'a3' })`

factory ([src/cards/_shared/hiramekiCharStun.ts](../../src/cards/_shared/hiramekiCharStun.ts)) は `type:'icon-flash'` + `scope:'on-evidence'` + effect `choice → atom sceneSetState (uid:$pick, state:'sleep')` 構造。

## ファイル
- 新規: `tests/e2e/patterns/hirameki-char-stun.spec.ts` (≤280 LOC、template = hirameki-draw.spec.ts)
- 関連: `.claude/bugs/BUG-035.md` (Phase 7 deferred、$pick auto-resolution gap)

## 検証スコープ — B 採用 (engine 探索結果による fall-back)

scope A (state 変化検証) は engine 探索で不可と判明:
- `entryToCtx` (`resolve/stack.ts`) は `dyn` 未供給、choice resolver は `idx=0` 既定
- `sceneSetState` atom (`atom-handlers.ts`) は `'$pick'` リテラルそのまま受取、substitution 未実装
- `target/resolve.ts` の pick は `picked` 引数必須、auto-resolve なし
- `resolver.ts:12` コメント「Phase 7 で実装」 → known deferred

→ scope B に切り下げ、no-op fallback を文書化 + BUG-035 として登録。

## 検証層 (各カード、合計 7 tests)

1. **shape**: `effect.kind === 'choice'`、`options[0].verb === 'sceneSetState'`、`args.state === 'sleep'`、`args.uid === '$pick'`、`target.query.area === 'scene'` / `side === 'either'` / `n.max === 1`
2. **fire path (no-op fallback)**: dispatch `actionAgainstCase` → pendingHirameki populate → `hiramekiResolve('fire')` → scene state **不変** (`'active'` のまま) + pending クリア (BUG-035 既知挙動を明示)
3. **skip path**: 同 dispatch → pendingHirameki populate → `hiramekiResolve('skip')` → scene state 不変 + pending クリア
+ **negative**: D08015 (icon-flash 非持ち) → pendingHirameki null

## fixture (Round 4j-fix test-isolation 流用)

- opp.partner = `D11001` active partner-area (attacker)
- self.case = `D08026` 事件編 colors=['青']
- self.evidence = `[{ cardId: <対象>, ... }]`
- self.deck = 25 枚
- self.scene[0] を state='active', isNamed=false 正規化 (default 3 件のうち 1 件を BUG-035 不変 assert 用に使用)
- pendingEffects = []

useHiramekiFlowDriver は `pending.player==='self'` で early return → test が pending 観測可能。

## 完了条件
1. typecheck clean / docs:check clean
2. unit 1467 PASS + 1 skipped (engine 編集なしで回帰なし)
3. E2E 31 → 38 PASS + 1 skipped (+7 = 2 カード × 3 + 1 negative)
4. smoke 525/475 baseline 完全維持
5. BUG-035 登録 (Phase 7 で fix 予定、水平展開 9 件明記)
6. spec doc + session log + README + memory 整備

## commit
`test(e2e),docs(bugs): Round 4k — hiramekiCharStun 2 カード E2E (D08019 a2 / D11009 a3) + BUG-035 ($pick auto-resolution Phase 7 deferred) 登録 + 共通パターン 6/5 拡張`

## 進捗影響
- 共通パターン spec: **5/5 → 6/5 拡張** (hiramekiCharStun shape + queue 検証、state 変化は Phase 7 で深掘り)
- BUG-XXX: 計 35 件、修正済 32 件 + 未着手 BUG-035 + UI 系
- 次 round 候補: Phase 7 ($pick auto-resolution + 9 件水平展開)、Round 4l+ UI
