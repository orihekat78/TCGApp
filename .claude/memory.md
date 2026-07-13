# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 =
> [2026-07-13.md](sessions/2026-07-13.md)。

## 2026-07-13 - Codex environment upgrade

- Global defaults: GPT-5.6 Terra medium; review Sol; Luna/Terra/Sol custom roles added.
- Added global `codex-risk-router`; fresh-task probes route T0/T1/T3 to GPT-5.6 correctly.
- Replaced root startup rules with a compact router and added scoped AGENTS for engine/cards/UI/tests/docs.
- Added `conan-session-router`; route probes pass for question, Engine, and new UI. Single-card wording tightened so `card-wave` is batch-only.
- Disabled implicit `using-superpowers` through its Codex policy; fresh-task probe now loads only `conan-session-router`. Migration checker detects policy loss after plugin cache updates.
- Added deterministic `.codex/context/current.md` generation via `npm run docs:codex-context`; focused test passes and output is bounded to 80 lines.
- Regenerated `.claude/auto/structure.md`. Existing application implementation changes were preserved and not modified by this environment work.

## 2026-07-13 — Claude → Codex migration audit

- `caveman@caveman` は enabled、skills 認識済み。ただし plugin の
  SessionStart 自動注入は task log に証跡なし。
- 全 Codex task 用の正本として `C:\Users\arumi\.codex\AGENTS.md` を追加。
  caveman full、言語維持、安全・明瞭性例外、task-local 停止を定義。
- README の active governance 参照 3 件を root `AGENTS.md` へ統一。
  `.claude/CLAUDE.md` は Claude 互換 copy として温存。
- 新規 task probe で root `AGENTS.md` 内の stale `.claude/AGENTS.md` 参照を
  検出し、存在する root `AGENTS.md` へ修正。
- `.codex/hooks.json` の Claude/GNU 前提 PostToolUse hook に
  `commandWindows` を追加。review で quoted `git commit` 偽陽性を検出後、
  PowerShell AST 判定へ変更。commit / quoted / status / compound probe green。
- `C:\Users\arumi\.codex\config.toml` から平文 GitHub PAT と旧 GitHub MCP
  block を除去。GitHub App connector を継続利用。
- 水平確認: project skills 3 件、Serena/Firecrawl/claude-mem MCP、主要 plugins
  は Codex から利用可能。Claude permission allowlist と claudeMdExcludes は
  Codex へ直訳せず、Codex permission profile と targeted rule reads を維持。
- 新規 Codex task 2 件で global caveman full と root AGENTS 読込を実測。
  独立 review は初回 Important 1 件を上記修正後、再 review CLEAN。

## 2026-07-13 — B09033/B09033P repeatOptional

- 公開windowからの反復任意登場は `repeatOptional` を追加。各 round は human UI で決め、残り sequence は最終判断まで停止する。
- deck の候補 UID (`cardId#index`) を `sceneEnter` まで保持した。同一IDが公開windowに複数あるとき、選択した実体だけを splice / bind prune し、残ったコピーを次 round で選べる。focused probe で後方 duplicate を選ぶ RED→GREEN を確認。
- 水平確認: deck window binding は splice 後により大きい index を rebase。`hasPendingHumanPick` に repeatOptional を追加して turn driver の早期再開を防止。
- Sol probe: 初回windowは owner 非human / spectator では既存 AI heuristic が選択し、`repeatOptional` のみ auto-skip。production trigger probe は `event._resetRegistry()` も reset しないと listener が多重登録され、偽の反復登場になる。

## 2026-07-13 — deferred T3 four-card wave

- B09024: `triggeredAbilityAura` の合成IDへaura bearer UIDを含め、付与triggerを一度だけqueueする。leave-to-remove batch は発火時点のauraをsnapshotする。
- B03042: `distinctColors` を target query / resolver / UI / AI へ配線。human pick は membership・重複・max・cross-pick制約を検証しつつ、合法なpartial/0選択を維持。
- B04055: `traitSharedWithTriggerRemoved` がremove event snapshotのtraitsを公開filterへ注入。`sourceInScene` が離場済みobserverのqueue解決を防止。
- B09033/B09033P: stable occurrence UID (`cardId#index`) で同一cardIdを含むdeck windowを反復pick可能にした。duplicate / 0 choice / owner=opp / spectator / production dispatch / UIを確認。
- Gates: focused suites・full Vitest (656 files, 5474 tests)・tsc・diff-check はgreen。Playwrightのhirameki 2 failureは `160986192` からのhuman target-pick仕様と旧assertの不一致で、今回wave以前から存在。

## 2026-07-13 — Wave D target-protection

- Added `untargetableByOppEffect` and `untargetableByOppEffectAura`. Resolver filters only cross-side effect picks; action target declaration and non-selection effects remain unaffected.
- Reader examines printed continuous abilities and face-up `on-set-host` riders; conditions use the bearer/host context. This unlocks B01006/P, B03030/P, B05008/P, B05048, and B08017/P.
- Focused evidence: bond-protection and sleep-host aura probes green, plus `tsc` and diff-check. Remaining: final T3 Sol review/full gates and B05048 spread.

## 2026-07-13 — next-session throughput correction

- Historical +50p evidence is batch throughput: pre-authored cards/probes and P-spread deployment, not 50 new T3 implementations.
- Next prompt now requires parallel Lane A (one T3 primitive) and Lane B (20–35 existing-DSL/green/twin/P printings); Lane C prepares grounding and RED probes.
- Do not compress B07011, B06095, B02022, and B02086 into one final session without a parallel bulk wave. Re-estimate when Lane B ships under 20p or a T3 needs new UI/state machinery.

## 2026-07-13 deferred continuation

- Shipped B02022/B02022P: `mustTargetSelfOnce` forces a scene character's first legal action target; it blocks case targeting only while a legal forced character exists. Partner actions neither force nor consume it. Official Q&A, RED probes, Sol re-review, focused probes, tsc, and diff-check green.
- Shipped six registry/P closures: B07030P/B07030P2/B07061P/B09055P/B09055P2/PR271. Grounded and text crosscheck green. Registry count 1999/2074; remaining 75.
- Lane B capacity correction: only six remaining printings were exact existing-DSL/twin closures. Remaining queue needs primitives or card-specific grounding; do not assume a 20-printing green wave.

## 2026-07-13 next-session portfolio

- CL327 CI green after `a3681d49` synchronized `mustTargetSelfOnce` with Task A validation whitelist.
- Next portfolio grounded: aggregate multi-pick (3), self set-card remove-to-enter (9), stacked identity/host stack (5), and choose-intercept/opponent decision (6). Ship one primitive at a time; RED/ownership/Sol checklist: `sessions/2026-07-13-2.md`.
- Shipped aggregate multi-pick: B04042/B04042P/B04084. Added aggregate level cap across resolver, human picker, and AI; B04084 binds exact remove occurrences before active/sleep split entry. Focused probes (34), tsc, diff-check GREEN; full local gates deferred to GitHub CI by user. Registry 2002/2074; remaining 72.

## 2026-07-13 parallel follow-up decision

- After repairing the current set-card CI failure, user chose parallel implementation through isolated worktrees: stack, hook/external-ability, picker/bind, and choose-intercept lanes. Shared contracts first; main integrates and ships sequentially. Session detail: `sessions/2026-07-13-2.md`.

## 2026-07-13 CI boundary / completion hypothesis

- Two CI checkpoints only: after four-lane primitive integration, and after all unlocked card additions. Intermediate lane work stays in isolated worktrees/integration branch, not `main`.
- Flow: parallel minimum engine+representative+RED -> serial shared-surface integration -> Sol/representative green -> parallel card/P/probe additions -> final CI. Optimistic completion = all remaining cards map to these lanes or existing DSL and registry reaches 2074/2074; new primitive/UI/semantic gaps invalidate the forecast.

## 2026-07-13 set-card shipment / CL328

- B06012/P, B06064/P, B07033/P/P2, and B09113/P shipped. `setCards.instanceId` is serialized; legacy exact-match tests were updated, B06012P text matches base, and production probes cover exact pick continuation.
- CL328 (`29242247994`) green: typecheck, full Vitest, lint chain, and smoke 1000. Registry 2011/2074; remaining 63.
- Next session starts four isolated representative lanes (stack, hook/external, picker/bind, intercept). CI only after serial integration and after all unlocked card additions; completion remains conditional on no new grounded primitive/UI/DSL gap.

## 2026-07-13 deferred primitive integration

- Integrated 11 printings: B06005/P, B08003/P, B08008 plus B02067/P, B04003/P, B08081/P. Registry 2022/2074; remaining 52; commit/CI pending.
- Stack identities now cover exact picker/transfer/cost, stale/duplicate/zero, AI/human and owner-relative opponent choice. B08003/P has blue-partner gate and Playwright 3-of-4 picker/cancel coverage. Sol CLEAN.
