# contactTargetMatches

「〚カード名/特徴/色〛のキャラに【カットイン】した場合」を表す **custom Condition** を返す。
コンタクト相手 (`$contact.targetUid`) が指定の カード名 / 特徴 / 色 のいずれかに一致するか判定する。

骨格凍結原則のため engine の condition kind は追加せず、`{kind:'custom', check}` closure で表現
(D11013 の inline custom と同型)。effect 内 `conditional{if}` で使う。

## シグネチャ

```typescript
export function contactTargetMatches(opts: {
  names?: string[];
  traits?: string[];
  colors?: string[];
}): Condition
```

## 判定ロジック

- `ctx.contact?.targetUid` を取得 (無ければ false)。
- `engine.read.char.{names,traits,colors}(s, targetUid)` の有効値を取得。
- `names` / `traits` / `colors` のいずれかの次元で一致すれば true (次元間 OR、配列内 OR)。

## 出現カード

| Card | 引数 | 公式 |
|------|------|------|
| B06041 (0664) | { names:['服部平次','服部平蔵','遠山和葉'] } | 〚名〛に【カットイン】した場合ドロー |
| B06092 (0711) | { traits:['喫茶ポアロ'] } | 〚特徴〛に【カットイン】した場合ドロー |
| B07009/B07009P (0741) | { names:['白鳥任三郎'], traits:['少年探偵団'] } | 名 or 特徴 |
| PR087/PR093 (0483) | { colors:['黒'] } | 【黒】キャラにカットインで AP+1000 |
| (参考) D11013 | inline custom (本helperの原型) | 〚警察〛に【カットイン】 |

## 注意

- 引継ぎ仕様: コンタクト相手が変装で入れ替わった場合は入替後のカードを参照 (read.char が有効値)。
- 骨格 (eval.ts) に condition kind を追加していない (custom 経由)。3 枚以上出現するため共通クラス化。

## 関連
- [card-condition-catalog.md](../card-condition-catalog.md) — custom は最終手段
- src/cards/ct-d11/D11013.ts — inline 原型
