---
date: 2026-06-03
title: ヒラメキを inline atom 化 (hiramekiDraw / hiramekiCharStun factory 廃止)
type: refactor
scope: cards
---

## ヒラメキ inline 化

カットイン inline 化と同じく、ヒラメキ factory を廃止し各カードに inline atom で記述 (D08013 a2 参照)。

- **D08024 a2** (`hiramekiDraw`) → `draw` atom を inline (D08013 a2 同型、byte 一致)。
- **D08019 a2 / D11009 a3** (`hiramekiCharStun`) → `sceneSetState` ($pick + 明示 target) を inline。
- `src/cards/_shared/hiramekiDraw.ts` / `hiramekiCharStun.ts` + 各 unit test + spec を削除。barrel export / index.test / shared-classes INDEX を更新。`caseTraitConditioned.test.ts` の hiramekiDraw fixture を inline AbilityDef に差し替え。

## ⚠ 知見: hirameki fire path では sceneSetState 短縮形を使わない

当初 hiramekiCharStun を `sceneSetState` 短縮形 (`{player,max,side,state}`) に collapse する設計だったが、e2e で **hirameki fire path が壊れる** ことが判明:

- `hiramekiResolve{fire}` handler は `chooseAtomTarget` ヒューリスティックで `$pick` を**自動解決**する (Phase 7-3)。これは **明示 `target`** が walk 時に存在することが前提。
- 短縮形は target を実行時 (atom-handler) に構築するため、fire 時に auto-pick されず side-channel (human pick) 待ちになり、挙動が変わる。
- enter/action trigger では短縮形が動作不変 (Phase2/Phase3 で検証済) だが、**hirameki fire path は別経路** で短縮形非対応。
- → hiramekiCharStun は明示 target 形 (factory 出力と byte 一致) で inline。

## 検証

- typecheck clean / vitest **1654 PASS** / smoke 1000戦 例外0 (502/498 不変) / e2e hirameki (draw 4 + char-stun 6) 全 PASS。
- 各カード test が動作不変オラクル (D08024/D08019/D11009 既存 test 不変 PASS)。
