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

## 次の優先順位

1. 残83枚を再分類する。優先順は既存DSL、twin/P-spread、1 primitiveで複数解禁、単発T3。
2. Intercept候補 B02022 / B02086 / B06095 / B07011 を、解禁数・UI追加量・既存hook再利用率で順位付けし、最高収益primitiveを1つだけ選ぶ。
3. green/twin/P waveを20〜35 printings単位で並列投入する。base/P本文を機械照合し随伴出荷する。
4. 最後にcrosscheck、registry漏れ、DEFERRED-INDEX、残printings再計数を行う。

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
