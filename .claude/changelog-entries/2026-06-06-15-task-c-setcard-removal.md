## タスク C: set-card 除去 verb (charRemoveSetCard) + B08034 工藤優作

**Round/Phase**: 2026-06-06 session — reasoning 残 new-feature 第3弾 (お勧め順 ③)。
在場キャラから setCard を1枚外す verb を additive 追加。

### engine 拡張 (additive — 新 verb 1)

- **`mutate.char.removeOneSetCard(s, uid)`**: setCards 末尾 1 枚を表向きにしてリムーブエリアへ (rules/16)。
  離場時の `removeAllSetAndStacked` と異なり在場キャラから 1 枚だけ外す。戻り値 = リムーブ cardId or null。
- **新 atom verb `charRemoveSetCard`** (effect.ts / validate.ts / atom-pick-spec.ts PA mode / atom-handlers.ts)。
  PA 短縮形 ({player, max, side, filter:{hasSetCards:true}}) で setCard 保持キャラを pick → 1 枚リムーブ。
  max:1 で skip 可 → chain break、no-candidate → __chainStepNoApply (resolve-picks) で「してもよい/そうした場合」を表現。
  既存カード未使用 → 完全 additive。

### 対応カード (2 枚)

- **B08034 工藤優作** (白Lv8) + 再録 **B08034P**:
  - a1: 【事件白】【パートナー白】【登場時】AP8000以下を1枚リムーブ + 自陣キャラにデッキ上1枚を裏向きセット
    (sceneRemove + charSetCard fromDeckTop、既存)。
  - a2: 【ターン1】自分の現場のキャラが推理したとき、セットされたカードを1枚リムーブしてもよい。そうした場合1引く
    (reasoning:end + triggerCharMatches{self} + chain([charRemoveSetCard{hasSetCards}, draw]))。

### 検証

- typecheck clean / 全 vitest **1847 pass / 1 skip / 0 fail** (回帰0) / lint errors=0。
- unit `tests/cards/setcard-removal-batch.test.ts` 3 件 (setCard 有り→リムーブ+draw / 無し→chain break / def)。
- e2e `tests/e2e/setcard-removal-2026-06-06.spec.ts` 2 pass (人間経路: する→holder の setCard リムーブ+draw / skip→draw なし)。
- ALL_CARDS 964 → **966**。

### 残課題

- 次: ④ evidence 抑制 (B03038、reasoning:before-add の card-triggerable 化が要・高難度)。⑤ B09047 はデータ無で DEFER。
