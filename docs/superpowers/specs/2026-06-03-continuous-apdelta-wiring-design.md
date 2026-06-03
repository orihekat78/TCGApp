# 設計: 常時有効型 continuousModifier.apDelta/lpDelta の engine 配線 + D08005 a1 宣言形化 (2026-06-03)

## ゴール
D08005 a1「【自分ターン中】自分の表向きの証拠1つにつき AP+1000」を **実際に動作する宣言形 (dyn 式)** にする。

## 根本原因 (調査済・コード根拠あり)
- `ContinuousModifier.apDelta`/`lpDelta` は **関数のみ型** (card-def.ts:70-71)。
- engine が `continuousModifier` から読むのは **`grantKeywords` のみ** (read/char.ts:101)。`ap()`/`lp()` (char.ts:15-35) は `turnEffects['apMod_*']` + override しか合算せず **apDelta/lpDelta を一切呼ばない** → D08005 a1 は **デッドコード** (リポジトリ全 grep で production consumer 0件)。
- `charModifyAP` atom はスナップショット (1回発火) モデルで、証拠枚数のターン中増減に追従できず `permanent` scope は毎ターン累積する → 常時再計算型には不適 (rules/24)。
- `$self.faceUpEvidence` (自分の表向き証拠数) を返す dyn root が eval.ts に未実装。

## 設計 (最小・骨格バグ修正例外)
骨格凍結原則の例外「骨格自体のバグ修正 (未配線の常時 AP/LP 修正子)」に該当。touched engine files = 3。

### 1. `src/engine/dyn/eval.ts` — `$self.faceUpEvidence` root 追加
`resolveSelf` 内、`sceneTrait` 分岐 (eval.ts:280-287) 直後・uid 要件チェック (eval.ts:288) の **前** に追加 (sceneTrait と同型、`ctx.source.player` ベースで uid 不要):
```ts
if (prop === 'faceUpEvidence') {
  const side = ctx.source.player;
  return state.players[side].evidence.filter(e => e.faceUp).length;
}
```

### 2. `src/engine/types/card-def.ts` — `ContinuousDelta` 型
`apDelta`/`lpDelta` を「dyn 式 (宣言形・推奨) | 定数 | closure (後方互換)」の union に拡張 (破壊的でない: 既存 closure も valid):
```ts
export type ContinuousDelta =
  | number
  | { dyn: string }
  | ((s: GameState, ctx: { uid: string }) => number);
// ContinuousModifier.apDelta?: ContinuousDelta; lpDelta?: ContinuousDelta;
```

### 3. `src/engine/read/char.ts` — `ap()`/`lp()` に配線
`keywords()` の continuous walk (char.ts:85-110、BUG-030) と同型の helper を追加し、`ap()`/`lp()` の戻り値に加算:
```ts
function continuousDelta(s, uid, which: 'apDelta'|'lpDelta'): number {
  // owner side 解決 → ctx={source:{player:owner,uid,area:'scene'},bindings:{}}
  // d.abilities を走査: type==='continuous' && continuousModifier[which]
  //   condition があれば evalCond で判定 (rules/24 常時有効型)
  //   number→そのまま / closure→call / {dyn}→evalDyn (number のみ採用)
}
// ap(): return base + apMod_* 合算 + continuousDelta(s, uid, 'apDelta');
// lp(): return base + lpMod_* 合算 + continuousDelta(s, uid, 'lpDelta');
```
import 追加: `evalDyn` (../dyn/eval.js)、`EffectCtx` (型)。**循環 import** (dyn/eval.ts→read/char.ts→dyn/eval.ts) は runtime-only (module top-level で相互呼出しなし) のため ESM で安全。tsc/vitest で確認。

### 4. `src/cards/ct-d08/D08005.ts` — a1 宣言形
```ts
const a1: AbilityDef = {
  id:'a1', type:'continuous', scope:'on-scene', condition:{kind:'turn',player:'self'},
  // 自分の表向きの証拠1つにつき AP+1000 (read 時に再計算)
  continuousModifier: { apDelta: { dyn: '$self.faceUpEvidence * 1000' } },
  description:'【自分ターン中】自分の表向きの証拠1つにつき、AP+1000。',
  ruleRefs:['rules/15-abilities-effects.md','rules/24-qa-naming-stun.md'],
};
```
未使用になる `GameState` import を除去。D08006 variant は `abilities` 配列を共有するため自動追従。

## ルール網羅性
- **rules/24 §常時有効型**: 条件成立中は自動的に効果あり / 条件外で即失効 → `ap()` が read 毎に再計算 + `condition` を evalCond で判定で満たす。
- **rules/25 §能力タイプ**: 常時有効型は「発動するものではない」→ atom (発動) ではなく read-time 合算が正。
- **rules/11 §推理**: 表向き証拠は推理等で生成。faceUp フラグで数える。
- **rules/19 §AP 下限なし**: 加算のみ、下限処理不要 (既存 ap() 同様マイナス可)。
- **rules/17 §条件未達=能力を持たない扱い**: condition false 時 delta 不加算で満たす。
- out of scope: a2 (declared 突撃付与) は変更なし。

## エッジケース (5+)
1. **表向き証拠0枚**: `$self.faceUpEvidence`=0 → AP+0 (base のみ)。
2. **全て裏向き**: faceUp=false は数えない → AP+0。
3. **相手ターン中**: condition `{turn,self}` false → delta 不加算 (rules/24 即失効)。
4. **D08005 が相手 scene 上**: owner='opp' → `players.opp.evidence` を数える (「自分」=操作プレイヤー視点で正)。
5. **ターン中に証拠増減**: read 毎再計算なので a2 で証拠を表にした直後の ap() に即反映 (スナップショット atom では不可能だった挙動)。
6. **charModifyAP との重畳**: turnEffects['apMod_*'] と continuousDelta は独立合算 (base + turnEffects + continuous)。二重計上なし。
7. **デッキ0/リフレッシュ**: ap() は evidence のみ参照、無関係。

## 水平展開
- closure 形 AP/LP 修正は **D08005 a1 が唯一** (他カードは charModifyAP atom)。横展開の修正対象なし。
- `lpDelta` は現状 production 未使用だが **対称配線** (将来カード + ability-def.test.ts の synthetic closure 用)。
- `grantKeywords` 経路 (char.ts:99-106) は不変。
- `ability-def.test.ts` の synthetic closure (`apDelta:(s,ctx)=>...`) は union に残るため PASS。

## 状態完備性
- 新規 GameState フィールド **なし** (証拠数から read 毎再計算)。
- `engine.read.char.ap` が唯一の AP 真実源 → UI (SceneArea 等) は自動反映。turnEffects とは独立。

## 検証
- tsc clean / 循環 import 動作確認 / vitest 全件 / smoke 1000 (D08005 は MVP D08 デッキに含まれるため AI 経路で実走、決着分布の変化を bisect 確認) / D08005 behavioral test (N枚→AP+N*1000、相手ターン無効、裏向き除外、相手 scene owner 判定) / adversarial verify workflow。
- BUG-XXX.md 起票 (apDelta 未配線)、convention 規則6 更新 (D08005 を closure 正当例から除外)、changelog、memory。

## 関連
- リファレンス: D08007 a1 dyn cutin (src/cards/ct-d08/D08007.ts:20)、$self.sceneTrait root (eval.ts:280)
- 規約: .claude/specs/card-authoring-convention.md
