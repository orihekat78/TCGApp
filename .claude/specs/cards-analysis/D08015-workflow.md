# D08015 小嶋元太 (コスト 3、青、Lv3) — 処理ワークフロー

## カード基本情報

| 項目 | 値 |
|---|---|
| ID | D08015 |
| 名前 | 小嶋元太 |
| 種別 | キャラ (character) |
| 色 | 青 |
| Level (コスト) | 3 |
| AP | 2000 |
| LP | 1 |
| 特徴 | 少年探偵団 |
| キーワード | (なし) |

## 効果テキスト (公式)

> 【登場時】カードを1枚引き、手札を1枚リムーブする。
> 【カットイン】AP＋1000

## アビリティ構造

- **a1** (triggered): `trigger.hook: 'enter'` + `selfOnly: true` → 登場時に発動
- **a2** (cutin): inline atom (continuousModifier AP+1000、scope=contact) — コンタクト中の AP+1000

> エンジン内部処理 (event 通知 / pick 解決 / continuousModifier) のトレースは
> [D08015-engine-flow.md](D08015-engine-flow.md) を参照 (カード固有の意味に無関係なため本図には含めない、BUG-064 / WORKFLOW-GUIDELINES)。

---

## a1 登場時効果

```text
[ 登場 ]
   │
   ▼
[ step 1: 1 ドロー ]
   │
   ▼
[ step 2: 手札から 1 枚リムーブ ]
   │
   ▼
[ a1 完了 ]
```

> **変装による登場では a1 は発動しない** — rules/09 「変装は『登場』ではない」より `enter` hook 自体が発火しないため、triggered listener も呼ばれない。
>
> **登場経路 (手札使用 / ネクストヒント / 効果による登場 / スイッチ) は a1 の挙動に影響しない** — 全経路がエンジン内部で `enter` hook 発火に集約されており、カード視点では「現場に登場した」事実のみが意味を持つ。
>
> **step 1 ドローのデッキ 0 枚処理 (リフレッシュ → リムーブ 0 なら敗北、rules/14) は `draw` atom の責務** — カード固有の挙動ではないため本図には含めない (BUG-036 で配線済)。
>
> **step 2 リムーブの選択者分岐 (human → EffectPickerModal / AI → heuristic) は engine 内部の `resolve-picks` の責務** — 同じく本図には含めない (BUG-053 / BUG-054 で配線済)。

---

## a2 カットイン効果 (コンタクト中)

```text
[ アクション / コンタクト発生 ]
   │
   ▼
[ 手札の D08015 を カットインとして使用 ]
   │ (1 コンタクト 1 枚制限、rules/09)
   ▼
[ コンタクト中 actor の AP +1000 ]
   │
   ▼
[ コンタクト終了で modifier 解除 ]
```

> コンタクト発生〜AP 比較〜終了の engine 内部トレースは [D08015-engine-flow.md](D08015-engine-flow.md) を参照。

---

## 関連 BUG 履歴

| BUG | 内容 | 状態 |
|---|---|---|
| BUG-005 | D08015 登場時効果不発 | 修正済 (`4c64c79` Round 4b で triggered listener 整備) |
| BUG-007 | 同根 — 7 hook 配線漏れ全般 | 修正済 (同上) |
| BUG-053/054 | human player の discard 選択が auto-pick されていた | 修正済 (`7b1e86b` / `bacc22b`) |
| BUG-036 | draw 内 refresh 失敗で deck-out 設定漏れ | 修正済 (`1480465`) |
| BUG-064 | 本図の抽象度漏れ + 100 行超過 | 修正済 (engine 詳細を engine-flow.md へ分離) |

## 主要関連ファイル

- `src/cards/ct-d08/D08015.ts` (本カード定義)
- `src/engine/listeners/triggered.ts` (a1 hook 配線)
- `src/engine/effect/atom-handlers.ts` (`draw` / `discard` / `sceneEnter`)
- `src/engine/effect/resolve-picks.ts` (`$pick` 解決、human chooser 分岐)
- `src/engine/mutate/{deck,scene}.ts` / `src/ui/components/EffectPickerModal.tsx`
