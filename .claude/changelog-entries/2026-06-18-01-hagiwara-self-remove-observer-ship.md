# engine拡張 wave#2 cluster16 fast-follow — 萩原千速 trio 出荷 (self-remove removal-observer)

**Round/Phase**: 2026-06-18 cluster16 fast follow-up (`cards/wave2-cluster16-hagiwara-pair`)。
cluster16 ship (883a0d64) で DEFER した PR280 / B06087 / B06087P を手 author + 専用安全テストで GREEN 化 → 出荷。

## 出荷 3枚 (ALL_CARDS 1338→1341、engine 変更 0)

| rep | 内容 |
|---|---|
| **PR280 / B06087 / B06087P** (萩原千速) | a1 = `partnerColorKeyword({color:'黄', kw:'突撃'})` / a2 = removal-observer: 【FILE6】+「このキャラとのコンタクトで相手の現場キャラを除去した」とき、自身をリムーブして手札から〚カード名[萩原千速]〛以外のレベル7以下の〚特徴[警察]〛キャラを1枚まで登場 |

## cluster16 ship での DEFER blocker 3点を解消

1. **auto-spec の over-fire バグ**: PR280 auto-spec が engine 非実在の `triggerCondition` フィールドを使用 → 正しくは
   `condition: and[fileAtLeast{6}, removedCharMatches{side:'opp', cause:'contact-ap', by:'self'}]`。B05108 a2 (optional sequence body) +
   D10007 a1 (removedCharMatches twin) + B09023 a1 (and 結合) の合成で手 author。
2. **partnerColorKeyword closure**: a1 は `grantKeywords:()=>[...]` の関数リテラルを含むため pure-JSON codegen 不可 →
   `__shared` TS import で手 author。
3. **初の「effect に removal verb (sceneRemove $self) を含む & 【ターン1】無し」removal-observer** (cluster15 spec §6.6 DEFER 境界) →
   専用 gate5 テスト `tests/cards/hagiwara-self-remove-observer.test.ts` で再入安全性を end-to-end 実証 → GREEN 化。

## 検証

- **専用テスト 9 pass**: filter 1対1 decoy (cardNameNot / trait / levelMax / kind / split-name複合名 / 近縁trait) +
  trigger gating (FILE<6 / cause≠contact / by≠self は非発火、declare→judge byUid 配線含む) +
  **自己 cascade 非再帰 pin** (sceneRemove{$self,cause:'effect'} の再 emit は side:own/cause:effect/byUid:undefined で
  condition {side:opp, cause:contact-ap, by:self} の3 leg いずれも reject → 再合致不能)。
- **敵対的検証 Workflow** (opus 4 lens 並列 + synthesis): 意味等価 / 再入安全 / gate5網羅 / rules整合 すべて **pass**、
  **ship:true / blocker 0**。
- tsc EXIT0 / vitest 全 pass (baseline 減なし) / smoke baseline **winsA=498 不変・0 exception** / **engine変更0**。

## 残 follow-up

- **B07051** (桃井恵子、deckReveal filterAny G2、別 capability・未 certify) → 次バッチで certify→出荷。
