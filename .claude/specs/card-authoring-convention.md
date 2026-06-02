# カード実装コーディング規約

公式テキストの動詞列を **1ステップ=1行 atom** に翻訳する。

リファレンス実装: D08013 / D08003 / D11019 / D11020。

## 規則

1. **1ステップ=1行**: `{ kind:'atom', verb, args:{...} },` を1物理行に。`kind`/`verb`/`args` を改行で割らない。
2. **comment-above**: 各ステップの **直前行** に公式テキスト対応句を `//` で置く（末尾コメント禁止）。`conditional` は `if`/`then` で意味が分かれる場合、分岐ごとに直前行コメント可。
3. **短縮形優先**: pick を伴う atom は `target:{kind:'pick'}` を書かず `args:{ player, n|max, side?, filter?|filterAny?, state? }` で書く。`n`=固定 / `max`=0〜max(skip可)。短縮形が効く verb は [engine-api-atom-verbs.md](engine-api-atom-verbs.md) の `ATOM_PICK_SPEC` が権威。
4. **冗長 choice 除去**: 単一 option を pick のためだけに包む `choice→options:[atom]` は、短縮形が pick を駆動するので削除。本物の「AかBを選ぶ」分岐のみ `choice` を残す（例: D11012 LP+1/AP+2000）。
5. **condition**: `condition:`(能力ゲート) と `conditional{if,then}`(効果内分岐) は [card-condition-catalog.md](card-condition-catalog.md) の語彙で。`if`/`then` も可能な限り1行。
6. **closure は最終手段**: `continuousModifier` の `apDelta`/`lpDelta` 関数 (D08005) と `kind:'custom'` check (D11013) は atom 化できない正当例。`dyn` 式 (D08007 `$dyn.*`) で代替可能なら優先する。
7. **ヘッダ / 順序**: ファイル冒頭に「公式テキスト全文 → a1/a2… の1行要約」。`ability` は `a1,a2,…` 連番で `abilities:[...]` 出現順と一致。各 ability に `ruleRefs` 必須。

## 例 (comment-above)

```typescript
steps: [
  // 証拠を1つ得る
  { kind: 'atom', verb: 'evidenceGain',   args: { player: 'self', n: 1 } },
  // 自分の証拠を1つ選び、手札に加える
  { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', n: 1 } },
  // 自分は手札を1枚選びリムーブする
  { kind: 'atom', verb: 'discard',        args: { player: 'self', n: 1 } },
],
```

## チェック

- [ ] 全 atom step が1物理行 + 直前行コメント
- [ ] 短縮形で書ける pick は短縮形（`ATOM_PICK_SPEC` 参照）
- [ ] 冗長 choice 除去 / 真の分岐は保持
- [ ] description・動作・テスト不変（reformat 時）
- [ ] [card-addition-checklist.md](card-addition-checklist.md) も通す

## 関連

- [card-condition-catalog.md](card-condition-catalog.md) — condition の早見表
- [engine-api-atom-verbs.md](engine-api-atom-verbs.md) — `ATOM_PICK_SPEC` / atom verb 一覧
- [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md) — Effect Descriptor DSL
