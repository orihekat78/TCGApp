# mini-wave: ② costPaid write 束 (4 cost kind へ導出値記録)

対象: B08041(removeSetCard の kind分岐) / B08068+B09005(revealFromHand) / B09050(removeFromHand
の level 継承) / B07025(sceneToDeckBottom の level 継承) / B09060(costRemovedMatches hand-source対応)。
rules/21「コストで行ったことは効果解決時にその状態 (増減後) を参照」/ rules/25 逐次内挿と整合。

## 既存パターン (cost/pay.ts 実測、removeDeckTop:269-280 / flipFaceUpEvidence:328-343)

`ctx.costPaid[key] = {...}` を pay() 内で書込み、`dyn/eval.ts:597-611 resolveCost` の汎用
`$cost.<key>.<path>` drillDown が任意 shape を読む (dyn/eval.ts 側の変更は不要 — 導出値を
pay() 側で確定させて格納する方針、`$trigger.cardLevel`(dyn/eval.ts:299-302) と同型判断)。

## 変更点 (cost/pay.ts、4 case に costPaid 書込み追加)

1. `removeFromHand`(91-100): `ctx.costPaid['removeFromHand'] = { ids, level: readDef.card(ids[0])?.level }` — B09050(level)/B09060(ids、costRemovedMatches経由) が読む
2. `revealFromHand`(103-112): `ctx.costPaid['revealFromHand'] = { ids, count: ids.length }` — B08068/B09005
3. `sceneToDeckBottom`(171-187): `ctx.costPaid['sceneToDeckBottom'] = { ids: cardIds, level: readDef.card(cardIds[0])?.level }` — B07025
4. `removeSetCard`(245-268): `ctx.costPaid['removeSetCard'] = { ids: setCardIds, kinds: setCardIds.map(id=>readDef.card(id)?.kind) }` — B08041
   (`import { def as readDef } from '@/engine/read/def.js'` を pay.ts に追加、dyn/eval.ts と同一 import 元)

## Condition 拡張 (cond/eval.ts)

- `costRemovedMatches`(既存kind、eval.ts:337-345): `key?: 'removeDeckTop'|'removeFromHand'|'removeSetCard'`
  追加 (既定 `'removeDeckTop'` = 後方互換、2点同期のみ)。`ctx.costPaid?.[cond.key ?? 'removeDeckTop']`
  に読替え。B08041 は `filter:{kind:'character'|'event'}`(TargetFilter既存field、effect.ts:262) で
  分岐。B09060 は `filter:{trait:'FBI'|'赤井家'}` で分岐 (2条件独立成立 = 両方成立時両方 true、公式Q&A確認済)。
- 新規 kind `costRevealedMatches`(B09005 のみ、B08068はcountのみでkind不要): `types/effect.ts`
  Condition union に `{ kind:'costRevealedMatches'; filter: TargetFilter; n?: number }` 追加、
  `cond/eval.ts` に `ctx.costPaid?.['revealFromHand']` 読み取り case 追加 (costRemovedMatches と同型
  ロジック流用)、`eval.ts:875` whitelist に `costRevealedMatches: true` 追加 (3点目、TS `satisfies`
  が漏れを compile error にする)。

## DSL 素描

- B08041: cost `removeSetCard{n:1}` : `conditional[{if:costRemovedMatches{key:'removeSetCard',filter:{kind:'character'}}, then:charModifyAP{delta:2000,duration:'turn'}}, {if:...{kind:'event'}, then:charModifyLP{delta:1,duration:'turn'}}]`
- B08068: cost `revealFromHand{filter:{trait:'喫茶ポアロ',kind:'character'}, n:{min:0,max:99}}`
  (「好きな枚数」=0可、公式Q&A明記) : `sceneRemove{filter:{levelMax:{dyn:'$cost.revealFromHand.count + $self.sceneTrait.喫茶ポアロ'}}, n:{max:1}}`
  (`$self.sceneTrait.<trait>` は既存 dyn、dyn/eval.ts:320 コメント参照 — 新規実装不要)
- B09005: cost `revealFromHand{filter:{trait:'探偵',kind:'character'}, n:1}` :
  `chain[sceneRemove{filter:{levelMax:7}, n:{max:1}}, conditional{if:costRevealedMatches{filter:{cardName:['江戸川コナン','工藤新一']}}, then:fileFlipTop{player:'opp'}}]`
  ⚠ **dossier stale訂正**: 「相手FILE top表向き verb不在」は誤り — `fileFlipTop`(atom-handlers/core.ts:402-409)
  は既に `a.player` 経由で相手側指定可 (コメント内に B09005 自身が exemplar として既記載)。本 wave の
  実質ギャップは costPaid revealFromHand bind のみ。
- B09050: cost `removeFromHand{n:1}` : `sceneSetState{state:'stun', filter:{trait:'探偵', levelMax:{dyn:'$cost.removeFromHand.level'}}, n:{max:1}}`
- B07025: cost `sceneToDeckBottom{filter:{trait:'マジシャン', excludeSelf:true}, n:1}` :
  `handAddFromRemove{filter:{trait:'マジシャン', levelMax:{dyn:'$cost.sceneToDeckBottom.level'}}, n:{max:1}}`
- B09060: cost `removeFromHand{n:1}` : 上記 costRemovedMatches{key:'removeFromHand'} 2 branch (FBI/赤井家独立、`.ids` を読む — `.level` は不使用)

## TDD probe 計画 (RED先行)

新規 `tests/engine/cost/cost-paid-write.test.ts` (cost.pay() 呼出し→ctx.costPaid形状 直接検証、
4 case × ids/level/count/kinds 各1 pin) + `tests/engine/cond/cost-removed-key.test.ts`
(key未指定=removeDeckTop既定回帰1pin、key:'removeFromHand'/'removeSetCard' 新規2pin、
costRevealedMatches filter一致/n不足/未払い時false の3pin)。

## エッジケース (rules/15,21,25準拠)

1. 0枚: revealFromHand n:{min:0} で0枚公開 → costPaid.count=0 → dyn加算0、costRevealedMatches false (rules/15「してもよい」)
2. デッキ/手札不足でコスト自体が支払えない場合: canPay が事前ガード → payInner 未到達 → costPaid
   書込み自体発生しない → 後続 condition は costPaid未定義で false (fail-closed、能力使用不可自体で自然に整合)
3. 変装引継ぎ: costPaid は ctx (effect解決単位) ローカルのため変装後の新キャラには引き継がれない
   (rules/09、costPaid はそもそも「今回のコスト支払い」限定の一時値)
4. removeSetCard n=1 のみ (B08041 は複数枚コストなし) — kinds 配列は要素1、条件分岐は単純 if/else
5. 同時2条件成立 (B09060 FBI かつ 赤井家 両特徴持ちカードをコストでリムーブ): 2つの conditional が
   独立評価され両方 true → AP+2000相当・突撃[事件]と突撃[キャラ]両方付与 (公式Q&A「両方の効果の条件を
   満たす」と一致、conditional を2本並べるだけで自然に表現可能・特別な複合 Condition 不要)
