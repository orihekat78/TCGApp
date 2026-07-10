# mini-wave design: attribution 2束 (2026-07-10) — index

対象12 unit (SMALL_GAP triage 確定分)。骨格凍結原則: 全項目 additive
(既存 emit payload / costPaid への field 追加、新規 Condition kind は1個のみ)。

## 束一覧

| 束 | 対象 unit | 詳細spec |
|---|---|---|
| ① byPlayer emit (leave:to-remove attribution) | B03116/B04089/B04091/B04094/B05107/B03112 | [miniwave-attribution-byplayer.md](miniwave-attribution-byplayer.md) |
| ② costPaid write (4 cost kind へ導出値記録) | B08041/B08068/B09005/B09050/B07025/B09060 | [miniwave-attribution-costpaid.md](miniwave-attribution-costpaid.md) |

## 3点同期の判定 (両束共通の設計原則)

- **既存 Condition kind への field 追加** (`removedCharMatches.byPlayer` / `costRemovedMatches.key`):
  2点同期のみ — (1) `types/effect.ts` union member の field 追加、(2) `cond/eval.ts` 該当 case の
  gate 追加。`eval.ts:875` whitelist (`satisfies Record<Condition['kind'],true>`) は kind 自体は
  不変のため触らない。
- **新規 Condition kind 追加** (`costRevealedMatches` のみ、①束には無し):
  3点同期必須 — (1) union 追加、(2) eval switch case 追加、(3) whitelist へ `kind: true` 追加。
  TS `satisfies` がこの3点目の漏れを compile error で強制する。

## 出典 (要都度 Read、推測補完禁止)

- rules/21-declared-ability-cost.md (コスト「自分の」省略・すべて行う要件)
- rules/15/25-abilities-effects/qa-effects-resolution.md (未解決効果・解決順・「〜してもよい」)
- rules/17-icons.md (【現場リムーブ時】方法問わず発火)
- 各 unit の TSV 印字全文・公式Q&A = `.tmp/_ground/<ID>.md` (2026-07-10 生成 dossier)
