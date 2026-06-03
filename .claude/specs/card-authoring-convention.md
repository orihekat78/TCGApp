# カード実装コーディング規約

公式テキストの動詞列を **1ステップ=1行 atom** に翻訳する。

リファレンス実装: D08013 / D08003 / D11019 / D11020。

## 規則

1. **1ステップ=1行**: `{ kind:'atom', verb, args:{...} },` を1物理行に。`kind`/`verb`/`args` を改行で割らない。
2. **comment-above**: 各ステップの **直前行** に公式テキスト対応句を `//` で置く（末尾コメント禁止）。`conditional` は `if`/`then` で意味が分かれる場合、分岐ごとに直前行コメント可。
3. **短縮形優先**: pick を伴う atom は `target:{kind:'pick'}` を書かず `args:{ player, n|max, side?, filter?|filterAny?, state? }` で書く。`n`=固定 / `max`=0〜max(skip可)。短縮形が効く verb は [engine-api-atom-verbs.md](engine-api-atom-verbs.md) の `ATOM_PICK_SPEC` が権威。
   - ⚠ **dyn-delta**: `delta` は **object 形 `{dyn:'...'}`** で書く（bare string は `resolveDynArgs` が評価せず AP が文字列化する）。`$pick` を伴う宣言能力 (D08026/D11021 の `$cost.*`) は explicit `target` を保持（短縮形は `costPaid` 不在で throw）。非 pick atom (cutin の `$contact.byUid` 等) の `{dyn}` は resolve-picks が解決する。
4. **冗長 choice 除去**: 単一 option を pick のためだけに包む `choice→options:[atom]` は、短縮形が pick を駆動するので削除。本物の「AかBを選ぶ」分岐のみ `choice` を残す（例: D11012 LP+1/AP+2000）。
   - 注: 単一 option choice の除去は **実行結果不変** (resolver は `options[0]` を実行) だが、AI の seeded 列挙木が変わり smoke の決着分布が動くことがある（カード動作は不変。0 exception で確認）。
5. **condition**: `condition:`(能力ゲート) と `conditional{if,then}`(効果内分岐) は [card-condition-catalog.md](card-condition-catalog.md) の語彙で。`if`/`then` も可能な限り1行。
6. **continuousModifier の AP/LP 修正は dyn 式 (宣言形・推奨)**: `apDelta`/`lpDelta` は `{dyn:'…'}` 宣言形で書く (D08005 a1 = `{dyn:'$self.faceUpEvidence * 1000'}`)。`engine.read.char.ap/lp` が read 時に走査・合算 (rules/24 常時有効型)。closure は最終手段 (`kind:'custom'` check D11013 等、dyn で表せない場合のみ)。⚠ apDelta/lpDelta の dyn 式は `$self.ap`/`$self.lp` を **参照しない** (ap()→evalDyn→ap() 無限再帰)。状態計算は dyn root (`$self.sceneTrait.<特徴>` / `$self.faceUpEvidence` 等) で表現し、カード側で `s.players.*.scene` を直接走査しない。
7. **ヘッダ / 順序**: ファイル冒頭に「公式テキスト全文 → a1/a2… の1行要約」。`ability` は `a1,a2,…` 連番で `abilities:[...]` 出現順と一致。各 ability に `ruleRefs` 必須。
8. **カットイン**: 旧 `cutinFixedAP` factory は廃止。各カードに inline atom で記述する (D08007 同型)。形: `type:'triggered'` / `scope:'on-hand'` / `trigger:{ hook:'effect:declared', optional:true, selfOnly:true }` / `effect:{ kind:'atom', verb:'charModifyAP', args:{ uid:'$contact.byUid', delta, scope:'contact' } }`。固定値は `delta:<number>`、現場特徴数スケーリングは `delta:{dyn:'$self.sceneTrait.<特徴> * N'}`。

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
