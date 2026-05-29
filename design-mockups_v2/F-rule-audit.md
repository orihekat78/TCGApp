# F — ルール準拠 + 既存システム整合性 監査

`conan/.claude/rules/*` および `conan/src/ui/styles/tokens.css` と本 design-mockups/ を突き合わせた結果。

---

## 🔴 重大なルール違反

### 1. 必要証拠数(targetEv)が公式と不一致

**rules/01-victory-conditions.md** によると:

| プレイヤー | 必要証拠数 |
|---|---|
| 先攻 | **7** |
| 後攻 | **6** |

**現状の実装**:
- `10-engine-stub.jsx` の `simulateMatch`: `targetEv = 4`(固定)
- `08-result.jsx` の `ResultStats`: `targetEv || 4`
- ステップフロー全体で "事件レベル 4" 表記が散見

**影響**:
- RESULT 画面: 「証拠 5/4」と表示されるべきところが本来「証拠 7/7」または「6/6」など
- 検証バナーで「LP 1・事件レベル 4」と書いた箇所 → 公式から逸脱

**修正案**:
- simulateMatch に `firstPlayer` プロパティ追加 → `targetEv = firstPlayer ? 7 : 6`
- 統計表示も実値に揃える

---

### 2. ヒラメキ仕様の説明が不正確

**rules/13-keywords.md** & **rules/11-reasoning.md**:
- 「ミスリード」は **相手の推理時に発動 → LP - X**
- 「ヒラメキ」は **証拠からリムーブされる瞬間に発動 → 各カード固有の効果**

**現状のチュートリアル(`08-tutorial.jsx` Step 5)**:
> 【ヒラメキ】の発動 — 証拠からリムーブされる瞬間に、そのカードの【ヒラメキ】効果が発動する。

**評価**: ✅ ここは合っている。

**但しヒラメキの図解(`ChapterIllustration`)では**:
> キャラ1枚をアクティブにする

これは特定カード(萩原千速等)固有の効果であり、ヒラメキ一般の説明としては誤解を招く。

**修正案**: 「カード固有の効果」と一般化、特定カード例を別表記に。

---

### 3. アシスト勝利不可ルール未表現

**rules/01-victory-conditions.md ⚠**:
> アシストを行ったターン中は事件解決を行えない

**現状**: 8-tutorial.jsx Step 1-6 は「コンタクト」のみで、勝利関連の手順を扱っていない。
- 解決編移行と勝利の前提条件説明が不足
- 「アシスト = パートナーをスリープしてFILEへ → アクティブ前提を満たさない」が言及されていない

**評価**: 既存のチュートリアル章 04「証拠と解決編」が locked のため未実装の説明部分。実装時の留意点として記録。

---

## 🟡 中程度の不整合

### 4. FILE 7 枚で解決編

**rules/01**: FILE が **7 枚以上** で事件編 → 解決編移行可。

**現状の表記**:
- `08-history.jsx` ヒートマップに「FILE 進捗 3/7」: ✅ OK
- `09-placeholders.jsx` MatchPlaceholder の case row: "5 つの事件カード" → これは事件カードの数で、FILE 数とは別概念。混同しないよう注釈推奨。

### 5. 推理 LP 仕様

**rules/11-reasoning.md**:
> LP値分の枚数をデッキ上から証拠エリアに追加

**現状**: チュートリアル用語集に「LP = Lv Point」と記載 — ✅ 正確化済(B-6 で対応)。

### 6. 現場 5 枚制限

**rules/03**: 現場最大 **5 枚**。

**現状**: `09-placeholders.jsx` の `BoardZone(cards={3})` 等で 5 枚以下 — ✅ 守られている。

### 7. 状態 3 種類

**rules/03**: アクティブ / スリープ / スタン の **3 種類**。

**現状**: 
- T(トークン) に `stateSleep` / `stateStun` / `stateNamed` あり
- "名乗り" は 4 つ目の概念だが、別系統(位置情報)なので OK
- チュートリアルでも 3 状態を明示 — ✅

---

## 🟢 整合性 OK 項目

| 項目 | 評価 |
|---|---|
| デッキ 40 枚 + パートナー 1 + 事件 1 = 42 枚 | ✅ B-7 で修正済 |
| 同 ID 上限 3 枚 | ✅ B-7 で修正済 |
| カラートークン(tokens.css ↔ T オブジェクト) | ✅ A-2 で監査済 |
| カード色 5 色 + 黄ボーダー区別 | ✅ |
| 状態色(sleep / stun / named) | ✅ |
| AP / LP / Lv 個別色 | ✅ A-2 で追加 |

---

## 🛠 推奨修正リスト(優先度順)

| 優先度 | 修正内容 | 対象ファイル |
|---|---|---|
| **高** | targetEv を 7/6 に修正 + 先攻情報 | `10-engine-stub.jsx`, `08-result.jsx` |
| 中 | チュートリアル章 04(解決編 + アシスト勝利不可)を追加 | `08-tutorial.jsx` |
| 中 | ヒラメキ図解の「キャラ1枚をアクティブ」→「カード固有効果」に一般化 | `08-tutorial.jsx` |
| 低 | "事件カード" と "FILE エリア" の用語混同を防ぐ注釈 | `09-placeholders.jsx`, `08-tutorial.jsx` |

---

## 既存システム(conan/src)との接続点

| 既存実装 | 我々のスタブ | 接続方法 |
|---|---|---|
| `conan/src/engine/cards/` の validateDeck | `engineStub.cards.validateDeck` | Phase 9-A で TS 化時にスタブ→本物に差し替え |
| `conan/src/ui/styles/tokens.css` の `--*` 変数 | `T` JS オブジェクト | 1:1 対応(A-2 で揃え済)。tokens.css への逆輸入可 |
| `conan/src/engine/flow/setup.ts` の createMatch | `engineStub.flow.simulateMatch` | 本物は本物の対戦進行、スタブはランダムシミュ |
| `conan/src/engine/types.ts` の CardDef | `window.CARD_POOL` のエントリ | 構造類似(num/name/color/cost/ap/lp/features/effectShort) |
| `conan/src/ui/components/Playmat.tsx` | `match-board.html` iframe | スナップショット — 動的化が今後の課題 |

---

## 結論

- **構造的なルール違反は targetEv の 1 件のみ**
- 用語・配色・枚数制限はおおむね公式準拠
- 既存システムへの移植時(Phase 9-A〜)に必要な差分は `E15-component-guide.md` に集約済
- 本監査で確認した修正は次セッションで実施可能(`memory.md` 残作業候補に追加)
