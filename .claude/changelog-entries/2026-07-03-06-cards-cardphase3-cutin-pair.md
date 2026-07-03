### CARD PHASE #3: cutin:used observer ペア B09086 諸伏高明 / B04090 ライ (2026-07-03)

**card-authoring (engine 変更 0)**。wave-16/18 で解禁済の cutin:used observer + self-in-contact guard
(B03118 キール idiom) を再利用した dormant-exemplar 解禁。両カードとも「このキャラのコンタクト中に
自分が【カットイン】を使用したとき」を effect の `conditional{if: ctx.contact?.byUid === ctx.source.uid}`
で判定 (ability.condition では ctx.contact 未 populate、B03118 教訓)。

**B09086 諸伏高明** (黄 lv5 ap5000 lp1、警察|長野県警):
- `triggerCutinMatches` 初 consumer (cond/eval.ts:533、wave-3 で本カード向けに出荷済)。
  matcher = `and[ triggerPlayerIs self, or[ triggerCutinMatches{cardName:諸伏景光}, triggerCutinMatches{trait:長野県警} ] ]`
  = 使用した【カットイン】カードが〚諸伏景光〛か〚長野県警〛のキャラのときのみ発火 →
  `charModifyAP{$contact.byUid, +2000, scope:contact}`。「か」= OR を matcher の `or` で表現 (単一 filter は field を AND)。

**B04090 ライ** (黒 lv8 ap8000 lp2、黒ずくめの組織):
- a1 = `partnerColorKeyword({color:黒, kw:'突撃[キャラ]'})` 共通クラス (【パートナー黒】〚突撃[キャラ]〛)。
- a2 = cutin:used observer (無条件 cutin) → `sceneEnter{from:remove, viaEffect, filter:{color:黒,levelMax:3,kind:character}, n:0-1}`
  でリムーブの【黒】lv3以下キャラを1枚まで登場 (B08029 伊織無我 deployStep 同型、効果登場ゆえ色制限 exempt)。

**検証:** probe test `cardphase3-cutin-observer.test.ts` (B03118 同型ハーネス、実 emit 経路 flow/contact.cutIn)
で名/特徴 match・非 match・ガード側コンタクト・非参加 DECOY を決定論確認 (BUG-117/118 教訓)。

gates: tsc0 / vitest 3798 pass +1skip (baseline 不変) / smoke:1000 winsA=498 exceptions=0 (engine変更0 証跡) /
playwright 123 pass / 8 lint。
