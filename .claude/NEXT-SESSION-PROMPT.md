# 次セッション — カード実装フェーズ

## 現在地

- ブランチ: `main`。最新: `348e98bb feat(cards): add hand cutin aura`。
- `origin/main` と同期済み。着手前に `git status --short` を確認する。
- カード母集団: **1960 / 2074 printings、残114枚**。
  直前の基準は 1957 / 2074（残117枚）。`348e98bb` で
  B06020 / B07003 / B07003P の3枚を追加した。広域TSV棚卸しの数値は使わない。
- 完了見積もり: **3〜5セッション**。先頭4件がT3のため、
  2セッション・57枚/セッションの完了は約束しない。
- S1/S2の作業は `2c7ec3b1` で出荷済み。
- B06020 / B07003 / B07003P は `348e98bb` で出荷済み。
  - 新規 `handCutinAura` reader: `src/engine/read/hand-cutin.ts`。
  - コンタクトとtriggered経路は `effectiveCutinAbilities` を共有。
  - Probe: `tests/cards/s3-hand-cutin-aura.test.ts`（7 green）。
- BUG-188 は手札カットインの重複観測防止を記録済み。

## 次の作業 — 最優先

リスク規模ごとに独立commitで実装する。各IDは先に grounding する。

1. B09024 — triggered ability aura。T3。合成abilityの識別子を1つだけ選択・queueできる場合のみ追加する。
2. B03042 — デッキwindow。探偵キャラを色が重複しないよう2枚まで選び、残りをシャッフルしてデッキ下へ置く。T3。
3. B04055 — リムーブされたキャラの特徴を引数にする公開カードfilter。T3。
4. B09033 / B09033P — 4枚公開windowからの反復登場。T2/T3。

カードを部分出荷しない。blockerを解消または確認したら `DEFERRED-INDEX.md` を更新する。

## 続き

- Wave D `untargetableByOppEffect`: B01006、B03030、B05008、B08017。
- Intercept cluster: B07011 RNG、B06095 8エリア aura、B02022、
  B02086 相手選択。その後のT3: D06013、B02039、B01082、B06025、B08059。
- 最後に crosscheck、parallel/twin spread、残カードの最終sweepを行う。

## 必須手順

- 最寄りの `AGENTS.md`、`.codex/context/current.md`、該当ルールだけを読む。
- authoring前に `npm run ground -- <ID>...` を実行する。
- `codex-risk-router` を使う。T3はSol reviewとfull gates必須。
- production dispatch、0選択経路、owner=`opp`、重複カードID、該当するルールタイミングを検証する。
- 出荷カードを `src/cards/_reuse/index.ts` に登録する。
- 判断と水平調査を `.claude/memory.md` に記録する。
- `.claude/auto/structure.md` は再生成する。生成物を手編集しない。

## commit前ゲート

```powershell
npx tsc --noEmit
npx vitest run <focused probes>
npx vitest run
npm run docs:structure
git diff --check
```

リスクに応じて lint / smoke / Playwright gate を追加する。ユーザーが明示した場合だけ
commit・pushする。セッション境界ごとにこのファイルを更新する。
