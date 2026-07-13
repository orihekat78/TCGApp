# 次セッション — カード実装継続

## 現在地

- branch: `main`。最新: `8be63e7e feat(cards): integrate deferred implementation wave`。
- `origin/main` と同期済み。開始時は `git status --short` を確認する。
- 正本の出荷数: **1991 / 2074 printings、残83枚**。
- CL322（`8be63e7e`）は Typecheck / Vitest / lint / smoke 1000 を含め全green。
- 今回出荷済み:
  - B09024: triggered ability aura（`3f8a5f68`）
  - B09033 / B09033P: repeat deck window（`89910a5e`、`dfbf5c00`でcompile修正）
  - B03042、B04055、Wave D target protection、Lane B twin/P 4枚、launcher/docs統合（`8be63e7e`）
- T3 review: B09024 / B09033-PはSol承認済み。B03042 / B04055 / Wave Dは統合gateで出荷済み。

## 次の実行 — T3前半と小粒DEFERを並列起動

- **Lane A — T3前半（engine writer 1人）**: Intercept候補 B02022 / B02086 / B06095 / B07011 を、解禁数・UI追加量・既存hook再利用率で順位付けする。最高収益primitiveを1つだけ選び、RED→GREEN、Sol review、full gates、CIまで出荷する。
- **Lane B — 小粒DEFER刈り（独立writer）**: Lane Aを待たず、既存DSLだけで書ける残カード、green/twin/P-spreadを20〜35 printings単位で実装・出荷する。base/P本文を機械照合し、P-spreadを持ち越さない。
- **Lane C — 並列準備**: 残83枚を「既存DSL / twin・P / 1 primitiveで複数解禁 / 単発T3」に再分類する。次のT3候補のgrounding、公式Q&A照合、RED probeを準備する。
- Lane A/Bの各commit後にCIを確認する。最後にcrosscheck、registry漏れ、DEFERRED-INDEX、残printings再計数を行う。

## 見積りの根拠と失敗条件

- 過去実績: 2026-07-13の夜間runは **+50 printings**。ただし前セッションでauthor済みのカード/probeと、P-spread自動展開をまとめて出荷したthroughputであり、新規T3を50枚実装した速度ではない。
- 直前の直列T3深掘りと、少数Wave D処理はこの大量waveを維持できなかった。以後、Lane Aを1 primitiveずつに限定し、Lane Bを止めない。
- **3 session完了は条件付き目標**: T3を前倒しで閉じ、各sessionでgreen/twin/P-spreadを20〜35 printings出荷できる場合のみ。大量waveが20未満、またはT3が新UI/state machineを要する時点で再見積りする。
- B07011（決定論RNG）、B06095（8エリアtrait）、B02022（action対象強制）、B02086（相手optional decision/contact限定防止）は独立T3 primitive。green/twin大量waveなしに最終1 sessionへ圧縮しない。

## 必須手順

- 最寄りの `AGENTS.md`、`.codex/context/current.md`、該当ルールのみ読む。
- authoring前に `npm run ground -- <ID>...`。
- `codex-risk-router` を使う。T3はSol review、RED→GREEN、full gates、UIならPlaywright。
- production dispatch、0選択、`owner=opp`、duplicate ID、twin差分、ルールタイミングを確認する。
- 出荷カードは `src/cards/_reuse/index.ts` へ登録し、判断と水平調査を `.claude/memory.md` へ記録する。
- `.claude/auto/structure.md` は生成する。手編集禁止。

## commit前ゲート

```powershell
npx tsc --noEmit
npx vitest run <focused probes>
npx vitest run
npm run docs:structure
git diff --check
```

- リスクに応じてlint / smoke / Playwrightを追加する。
- commit・pushはstanding authorization。merge/deploy/publish/PR操作もstanding authorization。
- セッション境界でこのファイル、memory、DEFERRED-INDEXを更新する。
