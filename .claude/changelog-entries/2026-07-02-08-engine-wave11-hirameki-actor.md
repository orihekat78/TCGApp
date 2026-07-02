---
date: 2026-07-02
phase: engine拡張 wave-11 (Track A1 structural)
kind: feat
---

## engine 拡張 wave-11 — hirameki actor payload (`$trigger.byUid`「アクション中のキャラ」) + consumer 4枚

「アクション中のキャラ」= アクション[事件] した actor を【ヒラメキ】が解決するための payload 貫通を追加。
公式Q&A (B05111): 「アクション中のキャラ」=「現時点でのアクションを行っているキャラ。【ヒラメキ】に
おいてはアクション［事件］でこのカードの【ヒラメキ】を発動させたキャラが該当する」= actor 単独。

### engine/UI (additive payload threading)
- `action-case.ts` removeOpponentEvidenceTop: `evidence:remove-by-action` emit payload に
  `byUid: ax.byUid` (actor uid snapshot) を併記。既存 consumer は player/ev のみ参照 → additive。
- `triggered.ts` handleEvidenceRemovedHook: payload 型に `byUid?`、optional 経路 pushPendingHirameki に
  `actorUid: p.byUid` 貫通 (forced 経路は baseCtx.triggerPayload=payload に既載)。
- `hirameki.ts` PendingHiramekiSide / `store.ts` PendingHirameki: `actorUid?: string` field 追加。
- `useEngineDispatch.ts` hiramekiResolve: pick 解決段 ctx.triggerPayload + queue payload に
  `byUid: pending.actorUid` 復元 → atom 実行時 (entryToCtx triggerPayload) に `$trigger.byUid` が解決。

### consumer カード 4枚 (REUSE_CARDS)
B03085 諸伏景光 / B03085P / B05032 大滝悟郎 / B05111 ゾンビ。全 a2 =
【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる =
`sceneSetState{uid:'$trigger.byUid', state:'stun'}` (optional trigger + caseStatus 解決編 condition)。
候補 = actor 単独 singleton → optional fire/skip が「1枚まで(0可)」の決定空間と一致。
a1 群 (登場時 remove-enter / 現場リムーブ時 contact-gated stun 等) は既存 verb reuse。

### gates
tsc0 (app+scripts) / vitest 3688 pass +1skip (新 behavioral test 7、`engine-wave11-hirameki-actor.test.ts`) /
smoke:1000 winsA=498 exceptions=0 不変 (4枚非MVP+additive) / 8 lint errors=0。

### additivity 根拠
既存 evidence:remove-by-action の a2 effect で `$trigger.*` を参照するカードは 0
(既存 $trigger 使用は contact:start/reasoning:end hook のみ、a2 は draw/mill/handAddFromRemove/
sceneSetState-$pick)。resolveEffectPicks は triggerPayload を preserve のみ (candidate filter 不使用)。

DEFER: B08006 (a2 同機構だが a1【宣言】下に重ねる が別 primitive 要)。
