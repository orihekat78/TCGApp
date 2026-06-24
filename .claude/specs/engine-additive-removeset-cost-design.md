# engine additive wave: Cost `removeSetCard` (2026-06-24)

> 骨格凍結 additive 例外 (CLAUDE.md「骨格凍結原則」公式ルール由来の新表現)。
> 前 wave (lvlDelta + stunChar、a206e9dc) と同じ流儀。card 出荷は並行 card session。

## 解禁カード

- **B08033 工藤有希子** a2 コスト「現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブする」

## 公式 QA 確定 (B08033 qa 列)

- 「キャラ2枚から1枚ずつリムーブ」可 (合わせて2枚 = 分割可)
- コスト (「:」左) は **自分のカードのみ** (相手カード不可、rules/21)
- host 自身の set card も数える (自身選択可)
- 対象は **裏向き** (faceUp:false) のみ

## Cost union (effect.ts)

```ts
| { kind: 'removeSetCard'; n: number }
```

count-based。`candidates()` は set card を Candidate 列挙しない (sub-entity) ため
TargetingRef 不使用。`discardEvidence`/`removeDeckTop`/`fileFrom` と同型の self-pool count コスト。

## honor sites (前 session stunChar と同 5 点 + mutator)

| site | 内容 |
|------|------|
| `types/effect.ts` Cost union | 上記 kind 追加 |
| `cost/evaluate.ts` canPay | self 全 scene の **faceUp:false set card 総数 ≥ n** / COST_KIND_MAP 追加 |
| `cost/pay.ts` payInner | `ctx.dyn.costParams.removeSetCard.hostUids:string[]` (1 removal=1 entry、repeat で 2-from-1 可) 優先 → 無ければ scene 順 fallback。各 removal は mutator 経由 |
| `ui/hooks/useActionsPanelFlow/cost.ts` costToText | `裏向きセットされたカードを N 枚リムーブ` (tsc never-guard 強制) |
| `scripts/taskA-validate-specs.cjs` COSTS | `'removeSetCard'` 追加 + sync-test |
| `mutate/char.ts` removeOneSetCard | **opts 拡張** (下記) |

## mutate/char.ts: removeOneSetCard opts 拡張 (additive)

```ts
removeOneSetCard(s, uid, opts?: { faceDownOnly?: boolean; cause?: 'effect' | 'cost' })
```

- default `{faceDownOnly:false, cause:'effect'}` = 既存 B08034 挙動 **完全保存** (回帰0)
- cost は `{faceDownOnly:true, cause:'cost'}`。faceUp:false の末尾 entry を splice、
  表向きでリムーブエリアへ、`setcard:leave` emit

## hook 相互作用 (faithful)

- `setcard:leave` listener 実在: **B07034**(self側「裏向き set card が離れるたび draw」純 observer、
  ability gate 無) / B02020(opp側)
- cost で自 set card 離場 → B07034 **発火が正** (テキスト「離れるたび」、B07034 QA で多様な
  leave cause を発火確認、rules/21 の「自分の能力/効果」gate は B07034 に無い)
- precedent: `removeFromScene` cost も `cause:'cost'` で leave hook emit (viaCost 抑制は未実装 TODO)

## エッジケース

1. set card 0 枚 → canPay false
2. ちょうど n 枚 face-down → 全リムーブ
3. face-up set card のみ (face-down < n) → canPay false (face-up 数えない)
4. 1 キャラに 2 枚 face-down → params `[A,A]` で 2-from-1 可
5. 自 scene に B07034 → 2 枚リムーブで B07034 が 2 回発火 (draw 2、ターン2 内)
6. `pay` (複合コスト) 内ネスト → payInner 再帰で動作

## 回帰 0 保証

既存カードで `removeSetCard` 宣言 0 (B08033 は card session 出荷) → smoke **winsA=498 不変**、additive。

## テスト (`tests/engine/cost-remove-set-card.test.ts`)

canPay 3 経路 (≥n / <n / face-up 除外) + pay (params split / fallback / cause:'cost') +
B07034 end-to-end 発火 + pay-nest。

## rules 参照

- rules/16 (カードのセット: 離場時表向きリムーブ) / rules/21 (コスト「自分の」省略・全部行えなければ不可)
- rules/15・25 (cost→effect 解決順、観測者型 trigger の queue)
