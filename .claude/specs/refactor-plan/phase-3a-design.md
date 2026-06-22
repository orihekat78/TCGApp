# Phase 3a 設計: atom-handlers.ts 分割 (着手前設計レビュー、2026-06-22)

挙動完全不変。`src/engine/effect/atom-handlers.ts` (1828 行・単一巨大 `runAtom` switch・55 verb)
を **extract-and-dispatch** でドメイン別ファイルへ分割。外部 API は barrel 再 export で不変。

## 不変条件 (byte-identical)

- 各 case body は **文字通り無改変**で handler 関数本体へ移す (`return;` はそのまま void 関数の return)。
- `runAtom` の preamble (pick-bind writeback L312-331) は barrel 内 `runAtom` の switch 前に存置。
- exhaustiveness `default: const _exhaustive: never = verb` を barrel switch に存置 (全 verb 網羅を TS が強制)。
- safety net: tsc (`noUnusedLocals`/`noUnusedParameters`=true で import/param 漏れ即検知) + full vitest ≥2783 +
  smoke:1000 baseline 完全一致 + e2e 回帰0 + eslint 新規0。

## モジュール構成 (計画 4→**5** に補正)

計画は core/scene/char/picks の 4。core に lifecycle/control verb を入れると ~750 行で目標 <500 超過のため
**misc.ts を分離**して 5 ファイルに補正 (各 <~560)。挙動不変・配線同一。

```text
src/engine/effect/
  atom-handlers.ts            barrel: 分割 handler import + _shared 再export + runAtom(preamble+dispatch switch)
  atom-handlers/
    _shared.ts                Player型 / 8 helper / Pending*Side 2型 + _drain*2 + declare global 2
    core.ts                   zone primitives 18 verb
    scene.ts                  scene 8 verb
    char.ts                   char stat/ability 12 verb (+charSetAP/LP は barrel inline throw)
    picks.ts                  deck-reveal/reorder pick 4 verb
    misc.ts                   lifecycle/control 10 verb (log 含む、+noop は barrel inline)
```

### _shared.ts (全 module-private 共有物)

- `type Player`
- helper 8: `targetFilterToPredicate` `requireField` `resolvePlayer` `resolveBindRef`
  `resolveDeltaToNumber` `normalizeTargetToString` `hasNorMax` `paShortFormAwait` (全て export)
- side-channel: `declare global` ×2 + `PendingDeckRevealSide`/`PendingDeckReorderSide` 型 +
  `_drainPendingDeckRevealSide`/`_drainPendingDeckReorderSide` (export)

### verb→file

- **core**: draw discard mill fileAdd filePopToHand fileRemoveTop fileFlipTop evidenceGain
  selfToEvidence evidenceLose evidenceToDeck evidenceFlip evidenceToHand handToEvidence
  handAddFromDeck handAddFromRemove deckShuffle removeAreaAllToDeckBottom
- **scene**: sceneEnter sceneSwitch sceneRemove charRemoveSetCard sceneToHand sceneToDeck
  sceneSetState sceneDisguise
- **char**: charModifyAP charModifyLP charModifyLevel charOverrideAP charOverrideLP
  charGrantKeyword charRevokeKeyword charDisableOriginal charGrantAbility charSetTurnEffect
  charSetCard charStackCard
- **picks**: deckRevealUntil deckToBottomBound boundToRemove souza
- **misc**: partnerAssist partnerSetState partnerSolveCase caseToResolved startContact
  endActionEarly setEventUseBan setHiramekiSuppress expandActionTargets **log**

合計: core 18 + scene 8 + char 12 + picks 4 + misc 10 = 52 (file) + barrel inline 3 = **55** (全 AtomVerb 網羅)。
※ `log` (L1790-1801、resolvePlayer+LogEntry+mutate.log.append、verb 非参照) は設計レビュー BLOCKER で
脱漏が判明し misc に追加 (本番 D05004/B01074 使用・AtomVerb union member・exhaustiveness `never` 対象)。

### barrel inline (抽出しない trivial case)

- `case 'charSetAP':` / `case 'charSetLP':` — throw-only (誤用ガード、atom-handlers.test.ts:483-489 が固定)
- `case 'noop':` — `return;`

## verb パラメータ規約

handler body が変数 `verb` を参照する 17 case (paShortFormAwait / tryRePickFromAtom の `{kind:'atom',verb,..}`)
のみ signature に `verb: AtomVerb` を追加し dispatch から渡す。非参照 handler は省略。
`noUnusedParameters` が誤付与を即 error、`Cannot find name 'verb'` が漏れを即 error → 機械的に確定 (17 case
の列挙は review-records.md / codemod を参照)。

## 外部 API (barrel が export 維持、現依存元)

- `runAtom` (value) — index.ts / resolver.ts / 21 tests
- `_drainPendingDeckRevealSide` `_drainPendingDeckReorderSide` (value) — useEngineDispatch.ts / bug-136 test
- type `PendingDeckRevealSide` `PendingDeckReorderSide` — bug-132 / bug-136 test

barrel は `runAtom` を local export + 上記 drain/型を `./atom-handlers/_shared.js` から再 export。

## per-file import 分配 (設計レビュー MAJOR 反映、noUnusedLocals が最終 gate)

resolve-picks/atom-pick-spec の関数は _shared に集約せず使用ファイルへ直接 import (実装は codemod が body を
comment-strip scan して per-file に自動分配):
`_shared`=tryRePickFromAtom+buildShortFormPick / `core`=+ATOM_PICK_SPEC / `scene`=+engineCards /
`char`=+isShortFormDelta / `picks`=+pushPendingPickFromAtom+toPlainDeep+targetFilterToPredicate /
`misc`=resolvePlayer+LogEntry。各ファイル GameState/EffectCtx 型 + verb 参照時 AtomVerb。

## エッジ/罠

- Windows 大小無視 FS: `atom-handlers.ts` (file) と `atom-handlers/` (dir) はフル名相違で共存可。
  **`atom-handlers/index.ts` は作らない** (alias `@/engine/effect/atom-handlers` が dir-index に曖昧化する)。
- ESM 拡張子: bundler 解決上 tsc は `.js` を強制しないが、既存コード規約に合わせ `.js` 付与必須。
- side-channel global: declare global は `__pendingDeckRevealSide`/`__pendingDeckReorderSide` の 2 (_shared に置く)。
  他に `__humanPlayerSide` (scene/picks が read) `__chainStepNoApply` (core が read) を inline cast で触るが
  これらは **別ファイルで declare 済**・bare 識別子参照なし → 移送先で import 不要 (ambient 維持)。
- 各ドメインファイルは使用 import のみ宣言 (`noUnusedLocals` が余剰を弾く)。
- safety net: tsc は **src importer のみ** 検査 (tsconfig include に tests/ 無し) → 23 test importer の
  barrel symbol 取りこぼしは **full vitest 実走 (≥2783) が唯一の gate**。必須ステップ。
- 行移動のみ・本文不変のため smoke/vitest が byte 不変を直接担保。
- `a`(args) 非参照 4 handler (removeAreaAllToDeckBottom/startContact/endActionEarly/expandActionTargets) は
  noUnusedParameters(TS6133) を踏むため signature の該当 param を `_a` prefix 化 (body は無改変、codemod auto-detect)。
