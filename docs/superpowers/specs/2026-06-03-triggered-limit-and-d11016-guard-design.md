# 設計: triggered ability の limit enforcement + D11016 a1 ガード自己判定 (2026-06-03)

## ゴール
MVP 監査で確定した2件の triggered ability バグを修正する。

- **Issue1 (デッドコード)**: triggered ability の `limit:{kind:'turn',n}` (【ターン①】) が enforcement されない。declared フロー (declared-ability.ts:82-84) でしか limit を読まず、triggered 発火経路 (listeners/triggered.ts handleHook → event.queue) は limit/fire-count を一切見ない。影響: **D11016 a1** (action:guarded)・**D11007 a3** (contact:start) が1ターンに複数回発火。
- **Issue2 (broken)**: **D11016 a1** が「このキャラがガードしたとき」ではなく「いずれかのキャラがガードするたび」発火。matcher `(p)=>guardUid is string` は `card.uid` を参照できず (`TriggerDef.matcher` は (payload,state) のみ)、selfOnly:false なので絞られない。action:guarded の source.uid は攻撃者。

## 根本原因 (調査済・file:line)
- limit: 参照は declared-ability.ts のみ。triggered.ts (138-241) は selfOnly/matcher/matcherCondition/condition/effect のみ gate し event.queue。`event.queue` は (uid,abilityId) dedup なし。
- guard 判定: state-machine.ts:218-223 emit `action:guarded` payload `{byUid,guardUid}` / source `{uid:byUid(攻撃者)}`。matcher は card 非参照、condition は `{turn,opp}` のみ。

## 設計

### Fix1: triggered.ts で limit enforcement (declared と同じ declaredUseCount 流用)
`handleHook` の effect-exists チェック (triggered.ts:187) 直後、resolveEffectPicks の前に:
```ts
// 【ターン①/②】triggered ability の limit (rules/17、BUG-067 を triggered に拡張)
if (ability.limit?.kind === 'turn') {
  if (readChar.declaredUseCount(state, card.uid, ability.id) >= ability.limit.n) continue;
}
```
queue (triggered.ts:232-239) 直後に increment:
```ts
if (ability.limit?.kind === 'turn') flag.incrDeclaredUseCount(state, card.uid, ability.id);
```
import 追加: `char as readChar` (../read/char.js)、`flag` (../mutate/flag.js)。
- declaredUseCount は SceneCharacter.declaredUseCount[abilId]、`resetTurnFlags` がターン境界で player 毎に reset (flag.ts:56-69)。D11016 (condition {turn,opp}) は所有者の自ターン終了時に reset され、相手ターン中の発火を跨いで正しく1回に制限される。D11007 a3 ({turn,self}) も自ターン内で1回。
- `kind:'game'` は未使用 (将来仕様、reset がターン毎なので非対応で可)。

### Fix2: cond/eval.ts に `guardedBySelf` Condition kind + D11016 a1 を matcherCondition 化
effect.ts Condition union に追加 (contactOpponentApHigher の隣):
```ts
| { kind: 'guardedBySelf' } // action:guarded payload.guardUid === ctx.source.uid
```
cond/eval.ts evalCond に case 追加:
```ts
case 'guardedBySelf': {
  const guardUid = (ctx.triggerPayload as { guardUid?: string } | undefined)?.guardUid;
  return guardUid === ctx.source.uid;
}
```
D11016 a1 trigger を closure matcher から matcherCondition へ:
```ts
trigger: { hook: 'action:guarded', matcherCondition: { kind: 'guardedBySelf' } },
```
matcherCondition 経路 (triggered.ts:156-168) は ctxMc に source.uid=card.uid + triggerPayload=payload を詰めるため、guardUid===self を判定可能 (matcher closure では不可能だった)。未使用になる `GameState` import / selfOnly:false / closure matcher を除去。

## ルール網羅性
- **rules/17 §【ターン①】**: 各ターン1回だけ発動 → triggered でも enforcement (Fix1)。declared と同一意味論。
- **rules/07 §ガード**: 「ガードしたとき」= 自分がガードした時 → guardedBySelf (Fix2)。
- **rules/15 §条件発動型**: 一度発動したら効果は残る (limit は発動回数を制限、解決済み効果は無効化しない)。
- out of scope: declared limit (既に BUG-067 で正常)、`kind:'game'` limit (未使用)。

## エッジケース
1. D11016 が相手ターン中に2回ガード (再アクティブ後) → 1回目のみ a1 発火 (limit)、2回目は guardedBySelf true でも limit で skip。
2. 相手の別キャラ X がガード → guardedBySelf false で D11016 a1 不発火 (Fix2)。
3. D11016 が自ターンにガード (condition {turn,opp} false) → そもそも不発火 (不変)。
4. D11007 a3: 同一ターンに高APコンタクト2回 → 1回目のみ AP+3000 (limit)。
5. ターン跨ぎ: 所有者の自ターン終了で counter reset → 次の相手ターンで再度1回発火可。
6. limit を持たない triggered (大多数) → `ability.limit?.kind==='turn'` false で従来通り無制限発火 (不変)。

## 水平展開
- triggered limit を持つ MVP カード: D11016 a1 / D11007 a3 のみ (他は declared)。非MVP は partner abilities:[] のため影響なし。
- guardedBySelf を使うのは D11016 a1 のみ。action:guarded を listen する他カードは無し。
- limit enforcement は全 triggered ability に一律適用 (limit 無しは no-op)。

## 状態完備性
- 新規 state フィールドなし (declaredUseCount を流用)。reset は既存 resetTurnFlags。
- UI 反映なし (内部 enforcement)。

## 検証
- tsc / vitest 全件 / smoke 1000 (D11016/D11007 は D11 デッキに含まれ AI 経路で実走、過剰発火抑制で**決着分布が変化する見込み** — 変化を許容し bisect で挙動修正由来を確認)。
- behavioral test 新規: (a) D11016 a1 は self-guard で1回発火・同ターン2回目は skip、(b) 他キャラ guard では不発火、(c) D11007 a3 同ターン2回コンタクトで1回のみ。
- adversarial verify workflow。BUG-096 (limit) / BUG-097 (guard) 起票。

## 関連
- 監査: 本セッション 6レンズ MVP audit。リファレンス: declared-ability.ts:82-84 (limit)、contactOpponentApHigher (matcherCondition 先例)。
