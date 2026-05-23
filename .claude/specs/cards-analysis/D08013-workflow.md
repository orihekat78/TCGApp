# D08013 吉田歩美 (コスト 4、青、Lv4) — 処理ワークフロー

## カード基本情報

| 項目 | 値 |
|---|---|
| ID | D08013 |
| 名前 | 吉田歩美 |
| 種別 | キャラ (character) |
| 色 | 青 |
| Level (コスト) | 4 |
| AP | 4000 |
| LP | 1 |
| 特徴 | 少年探偵団 |
| キーワード | (なし) |

## 効果テキスト (公式)

> 【登場時】証拠を1つ得る。自分の証拠を1つ選び、手札に加える。自分は手札を1枚リムーブする。
> 【ヒラメキ】カードを1枚引く。

## アビリティ構造

- **a1** (triggered): `trigger.hook: 'enter'` + `selfOnly: true` → 登場時に発動、3 step sequence
- **a2** (hirameki): `hiramekiDraw({ n: 1 })` — 証拠リムーブ時に 1 ドロー

---

## a1 登場時効果 (3 step sequence)

```text
[ D08013 が現場に登場 ]
   │
   ▼
[ step 1: 山札の上 1 枚を証拠エリアに裏向きで追加 ]
   │ (evidenceGain n=1、自動実行、選択なし)
   ▼
[ step 2: 自分の証拠から 1 枚を選び手札に加える ]
   │ (evidenceToHand pick、modal で選択待ち)
   │   ・ human: EffectPickerModal で証拠候補から 1 枚 click
   │   ・ AI: heuristic で 1 枚自動選択
   │ 選択結果: 証拠 -1 / 手札 +1 (cardId は表向きで手札へ)
   ▼
[ step 3: 自分の手札を 1 枚リムーブ ]
   │ (discard pick、modal で選択待ち)
   │   ・ human: EffectPickerModal で手札候補から 1 枚 click
   │   ・ AI: heuristic で 1 枚自動選択
   │ 選択結果: 手札 -1 / リムーブ +1
   ▼
[ a1 完了 ]
```

> **変装による登場では a1 は発動しない** — rules/09 「変装は『登場』ではない」より `enter` hook 自体が発火しない。
>
> **登場経路 (手札使用 / ネクストヒント / 効果による登場 / スイッチ) は a1 の挙動に影響しない** — 全経路がエンジン内部で `enter` hook 発火に集約。
>
> **step 2 と step 3 は連続 modal フロー** — sequence 内に 2 つの pattern B atom (evidenceToHand pick / discard pick) があり、modal が順次 2 段階で表示される (BUG-075 / BUG-076 で対応)。
>
> **step 2 の候補が 0 件 (証拠エリアが空、ただし step 1 で +1 されるため通常は 1 件以上)** や、**step 3 の候補が 0 件 (手札が空)** の場合は modal 表示なしで skip される。

---

## a2 ヒラメキ効果

```text
[ 自分の証拠が「アクション[事件]」でリムーブされる ]
   │
   ▼ (rules/10 ヒラメキ発動チャンス)
[ ヒラメキを発動するか選択 ]
   │
   ├── 不発動 ─▶ そのままリムーブエリアへ、a2 終了
   │
   └── 発動 ─▶ カードを 1 枚引く (draw n=1)
              │
              ▼
              [ ヒラメキ後、リムーブエリアへ ]
```

> **ヒラメキは「証拠からリムーブされるとき」のみ発動可能** — rules/13 §ヒラメキ。アクション[事件] の証拠リムーブ時のみで、効果リムーブでは発動しない。
>
> **発動するか否かは所有者の選択** — rules/10、modal で確認。

---

## 関連 BUG 履歴

| BUG | 内容 | 状態 |
|---|---|---|
| BUG-073 | D08013 効果説明の不正確記述 (step 1 evidenceGain を見落とし、2 step として説明) | 修正済 (commit `0ebe43c` で訂正) |
| BUG-074 | evidenceToHand atom が target を string 期待、BUG-065 array 化と不整合で silent skip | 修正済 (`4f72085` で string\|array 両対応) |
| BUG-075 | sequence 内に複数 pattern B atom があると side-channel 上書き、step 2 modal 不在 | 修正済 (`ac2cfe6` で上書き防止) |
| BUG-076 | step 2 解決後に step 3 modal が出ない、連続 pick flow 不在 | 修正済 (`8d18c4f` で tryRePickFromAtom + evidence kind 対応) |
| BUG-077 | (本セッション末ユーザー報告) step 2 evidenceToHand のログは出るが、証拠 -1 / 手札 +1 が反映されない | 未着手 (要 RCA) |

## 主要関連ファイル

- `src/cards/ct-d08/D08013.ts` (本カード定義)
- `src/cards/_shared/hiramekiDraw.ts` (a2 共通クラス)
- `src/engine/effect/atom-handlers.ts` (`evidenceGain` / `evidenceToHand` / `discard`)
- `src/engine/effect/resolve-picks.ts` (`$pick` 解決、evidence kind 対応)
- `src/engine/mutate/evidence.ts` (`addFromDeck` / `removeTop` / `flipFaceUp`)
- `src/engine/mutate/hand.ts` (`add` / `discardToRemove`)
- `src/ui/components/EffectPickerModal.tsx` (human pick UI)
- `src/ui/hooks/useEngineDispatch.ts` (`effectPickResolve` dispatch)
