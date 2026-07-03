### engine wave-18: inContact TargetQuery + contact emit enrichment + optional contact-bindings 保持 (2026-07-03)

**Track A1 structural**。contact-participant pick vein を解禁 (grounding で「散らばった A1」判定が stale と実証)。

**engine 変更 (全 additive、既存挙動不変):**
- **`inContact?` TargetQuery 軸** (parked axis 463730af を land): pick を現コンタクト参加者
  (`ctx.contact.{byUid,targetUid,guardUid}`) に限定。candidates.ts `matchesQueryForChar` が honor
  (excludeSelf と同型の ctx 依存 char 述語) + atom-pick-spec pass-through。
- **contact emit enrichment**: `buildContactBindings(ax,p)` helper 抽出 (cutin inline を DRY 化) →
  disguise:into emit の payload に `player` + source に `bindings:contactBindings` /
  contact:start emit の source に `bindings:contactBindings` を追加。既存 consumer (selfOnly【変装時】/
  payloadKey B02079/D07018) は player/bindings を読まない → 挙動不変。
- **triggered.ts resolveCtx.bindings**: `{}` → `source.bindings ?? {}` (walk 時 optional/choice surface が
  contact bindings を capture 可能に)。
- **optional contact-bindings holder**: `__pendingEffectOptionalBindings` (pending-state.ts) を新設。
  resolve-picks.ts optional case が surface 時 capture → apply-pick.ts applyOptionalAndContinuation が
  **queue 6th arg (entry.bindings) 経由でのみ** contact を伝達 (ctx.bindings は fresh `{}`、aliasing 回避)。
  BUG-114 の choice-bindings 保持の optional 対称。

**exemplar カード (初 consumer):**
- **B04075 白鳥任三郎**: 【ターン1】相手 cutin/変装 → コンタクト中のキャラ1枚 AP-1000
  (multi-hook cutin:used+disguise:into / triggerPlayerIs opp / inContact pick)。
- **B04092 キャンティ**: 自分の他キャラ contact → optional self-sleep → コンタクト中のキャラ1枚 AP+2000
  (contact:start or payloadKey aUid/bUid + excludeSource / optional{chain} + inContact pick)。
- 残 clone (PR029/PR033 白鳥 / B04093 コルン) は card-phase authoring で解禁。

**process 教訓:** applyOptionalAndContinuation で resumeBindings を ctx.bindings に alias すると walk 中の
inner bind 書込 ($entered 等) が queue 6th arg を汚染し、既存の空 optional (B09038 sceneEnter) を破壊した
(full vitest で検出)。修正 = ctx.bindings は fresh `{}`、contact は 6th arg のみで伝達 (runtime entryToCtx で解決)。

gates: tsc0 (両 config) / vitest 3775→3788 pass +1skip (+13: axis 5 + consumers 8) / smoke:1000 winsA=498 exceptions=0 (挙動不変) / 8 lint errors=0 (side-channel allowlist に EffectOptionalBindings 追加)。
