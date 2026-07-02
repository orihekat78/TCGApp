# エンジン拡張 必要件数の上限調査 (2026-06-29)

全カード実装に必要な distinct エンジン拡張の **firm 上限を確定** した調査の記録。

## 結論

| 指標 | 値 |
|------|----|
| **firm 上限 (distinct エンジン拡張)** | **≈ 75 件** (レンジ 70〜80) |
| 内訳 | genuine 既知 G## ≈ 32 + genuine NEW ≈ 43 |
| 未実装カード総数 | 561 (universe 2049 − 実装 1488) |
| ENGINE0 (変更不要で author 可) | ≈ 215 枚 (分類 190 + stale gate 解放 ~25) |
| エンジン拡張要 | ≈ 346 枚 → ~75 gate に分散 (top 偏重 + 1-card 長裾) |

当初口頭見積り「~30」は **文書化済み近傍のみの過小評価**。真の上限は ~75。
多くの拡張は **1〜2 枚しか解禁しない逓減資産**。

## 方法

1. **機械算出** (`.tmp/_unimpl.cjs`): TSV 全 2049 行 − `export const <ID>:CardDef`/spread 登録 = 未実装 561 枚を確定。
2. **意味分類** (workflow `engine-gate-upper-bound`, 8 並列 opus): 561 枚を `ENGINE0 / G01-42 / NEW:<desc>` に分類。判定基準は `.tmp/_engine_ref.md` (現エンジン能力境界 + gate taxonomy)。→ ENGINE0=190 / distinct 既知 G##=37 / 生 NEW ラベル=106。
3. **vocab ground-truth 照合** (本体、決定論): hooks/atoms/conditions/continuous/cost/dyn の全 enum を抽出し、各 NEW を「vocab に有る=remap / 無い=確定」で判定。**agent verify は 2 回とも infra 失敗** (session limit → server rate-limit) のため本体で完遂。

数値の段階的圧縮: 生 `129` (dup + 未検証保守計上で膨張) → dedup `~89` → stale 除去 `~75`。

## stale gate (誤 DEFER、既に ENGINE0)

検証で「gate と思われていたが既出荷」と判明したもの。**該当 ~25 枚が DEFER→ENGINE0 へ再分類可** (即 author 可能、最も actionable な成果)。

| gate | stale 根拠 (src/engine 実コード) |
|------|----------------------------------|
| **G15 relative-AP** / **G16 relative-LP/level** | `resolveFilterDynObj` (effect/resolve-picks.ts:107) が field-agnostic + evalDyn root `$self.ap/lp/level` 既存 → `apMin:{dyn:'$self.ap'}` 解決済。candidates.ts:345 が same-AP 列挙 |
| **G11 hand-count** | `handAtLeast/handAtMost/handCountAtLeastOther` Condition 既存 |
| **G17 $revealed 色読み (n=1)** | `colorNot` (cond/eval.ts:311) + `boundMatchesFilter` (:273) + revealFromHand bind 既存。**n>1 のみ真 gate** |
| **G02 推理反応** | `reasoning:end` が card-triggerable 化済 (2026-06-06 task C)。「相手が推理したとき」= ENGINE0。※ misread 反応 (G04) は別=genuine |
| (参考) card-triggerable hook | **16 個** (`enter/effect:declared/action:pre-target/action:declare/action:guarded/action:end/contact:start/case:to-resolved/phase:end:start/leave:to-remove/evidence:remove-by-action/evidence:gain/reasoning:end/disguise:into/file:pop/setcard:leave`)。[card-impl-engine-gates.md](card-impl-engine-gates.md)「9 個のみ」は **stale** |

`opponentRestrict:['cutin','disguiseTrigger']` 既存・untargetable「選ばれない」既存・`charStackCard` 効果既存 (重ねコストは不在) も同様に確認。

## genuine NEW (vocab 不在=決定的、主要群)

- **set-card→host 継続 rider / 能力付与** (~14 枚、最大塊。read/char.ts continuousDelta は host def のみ walk、setCards は inert)
- **離場 prevention/replacement hook** (`replace`/`negate` Effect kind は宣言 only・throw、`on:'leave'` 未配線)
- **restriction flag 一族** (手札使用禁止 / ネクストヒント禁止 / アクション対象除外 / refresh 証拠抑止 / 色制限 bypass — ContinuousModifier に該当 field 無)
- **observer hook 群** (remove-area 離脱 / 味方被選択 / カットイン使用 / misread / 手札 name 公開)
- **alt 勝敗条件 書換** (gameResult 固定) / **捜査『発見された』binding** (atomSouza discard only)
- **dyn root 不在系**: `$self.sceneColor / stackedCount / sceneCardName`、opp-scene-count、lpSum
- **source verb 群**: remove-area→deck-top / 両側 char へ持ち主デッキ set / stack-as-cost / set-from-remove
- **auto-phase 非アクティブ aura** (auto-phase.ts:62 無条件 tryActivate、skip flag 無) / **startContact verb** / **forEach-scene-char setCard** / **cross-card ヒラメキ起動** / **filtered-keyword grant** / **charSetAP/LP-to-N** (throw stub) / **MR partner-area サブシステム** (設計のみ)

## 中間データ / 出典

- `.tmp/_unimpl.json` (561 枚 + テキスト) / `.tmp/_engine_ref.md` (能力境界 + G01-42) / `.tmp/_consolidated_primitives.json` (dedup 後 55) / `.tmp/_new_labels.txt` (dedup 前 92)
  ※ `.tmp/` は ephemeral。永続記録は本ファイル + memory `project-engine-extension-upper-bound`
- workflow: `engine-gate-upper-bound` (wf_75003687) / `verify-consolidated-gates` (wf_d42454ef)

## カード単位リスト (どれが ENGINE0 / どれが拡張要か)

全 561 枚の判定を **[engine0-vs-extension-2026-06-29.tsv](engine0-vs-extension-2026-06-29.tsv)** に出力 (列: `num / kind / verdict / gates / title`)。stale gate 補正適用済。

| kind | ENGINE0 | NEEDS-ENGINE |
|------|--------:|-------------:|
| character | 165 | 249 |
| event | 37 | 64 |
| case | 9 | 37 |
| **計** | **211** (raw 190 + stale 解放 21) | **350** |

- `verdict=ENGINE0` = エンジン変更なしで author 可 (例: stale 解放分 B07022 沖田総司=G17 / B04074 降谷零=G16 / B03030 伊織無我=untargetable)。
- `verdict=NEEDS-ENGINE` = 拡張要。`gates` 列に必要 gate (例 B01077=G27 random-discard / B02062=G05 opp-evidence observer / B02002=G19 sceneColor dyn / B02018=G08 setcard:enter)。206 枚は primary gate が `NEW:` (= ~43 distinct 新機構に分散)。
- ⚠ ENGINE0 判定は分類器の楽観値 + stale 補正。**実 author 前に per-card grounding / playwright human-path probe 必須** (stale-DEFER は両方向に振れる)。「即出荷確定」ではなく「ENGINE0 候補」。

## 残不確実性

- genuine NEW ~43 は **全件 file:line grounding 未完** (agent 2 連続 throttle)。vocab 不在は構造的に決定的だが **±5**。
- 単発 verify 完走 2 件: P45 auto-phase 非アクティブ=NEW 確定 / P55 relative-AP=ENGINE0 確定。
- 完全 ±1 精度には **低並列 (SUB≤4 sequential batch)** で 55 primitive を再 verify する必要 (server rate-limit 回避)。

## 関連

- [DEFERRED-INDEX.md](DEFERRED-INDEX.md) — 個別 DEFER カードの gate 記録 (本調査の一次裏付け)
- [card-impl-engine-gates.md](card-impl-engine-gates.md) — 2026-06-04 gate 早見表 (一部 stale、本調査で更新点を明記)
- 骨格凍結原則: [CLAUDE.md](../CLAUDE.md) — エンジン拡張は逓減資産、ENGINE0 author 優先
