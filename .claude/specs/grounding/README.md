# specs/grounding/ — grounding 判断の永続化 (2026-07-10 token 削減施策 #3)

grounding agent の**判断部分** (印字 ⇔ DSL 突合・engine gap 認定・DSL 案・tier 判定・罠) を
unit 単位で `<ID>.md` に保存する。機械事実 (TSV/登録/DEFER 行/capability) は保存しない —
`npm run ground -- <ID>` が毎回 fresh に出す (stale 防止)。

## 運用

1. **grounding 前**: `npm run ground -- <ID>` → `.tmp/_ground/<ID>.md` に「過去 grounding あり」と
   出たら本 dir の該当ファイルを Read。**再調査せず**、code 参照 (file:line) の現存だけ確認して着手。
2. **grounding agent への指示**: 報告は main loop に返すのではなく
   `.claude/specs/grounding/<ID>.md` に**直接 Write** させ、main loop へは 5 行以内の要約のみ返す
   (subagent 報告全文が main context に入るのを防ぐ)。
3. **出荷後**: dossier 冒頭に `> ✅ 出荷済 (commit <hash>)` を追記 (削除しない — clone/twin の参照元)。
4. file:line は書いた時点の snapshot。着手時に現存確認 (capability snapshot と突合)。

## 形式 (frontmatter 無し、100 行以内)

```
# <ID> <カード名> grounding (<日付>, <調査 model>)
> 状態: DEFER (T3) | ✅ 出荷済 (hash)
## engine gap / ## DSL 案 / ## tier + 理由 / ## 罠
```
