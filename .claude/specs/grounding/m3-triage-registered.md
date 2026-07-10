# M3 PA batch triage — 登録済 18 ID (2026-07-10)

前提: declared-ability.ts:62/147 PA gate + triggered.ts:180-200 collectCardsInPlay(partnerMR sentinel) は
既存配線 (mr-partner-area-core 2026-06-23)。**今session の新規解禁は「declared 型 PA 宣言」の human UI のみ**
(enumDeclaredAbilitySources partnerMR source + PartnerArea MR tile + flows resolve)。triggered/continuous
scope:'on-partner-area' は元々 engine 自動発火ゆえ本 UI 非依存 = 既に動作済。BUG-154 (mutate/char,scene の
findChar が scene-only → PA-MR を **uid:'$self' で mutate target にすると no-op**) は全18件で非該当と確認
(PA scope ability の target は他キャラ選択 or FILE/deck/hand 操作のみ、$self 直指定なし)。

## 分類別内訳
- DONE 8: B05027 / B06066 / B07039 / B08068 / B07015 / B08062 / B09002 / B09070
- UI_UNLOCKED 9: B05106 / B06003 / B07065 / B05005 / B09108 / B05086 / B06084 / B06098 / B06074
- SCOPE_FLIP 1: B05045
- SMALL_GAP 0 / BLOCKED 0

## DONE (triggered/continuous PA scope=既に自動発火、または PA句無し=常時通り)

- **B05027** 服部平次＆遠山和葉: a2「〜登場したとき…この能力はパートナーエリアでも発動する」→ `type:'triggered' scope:'on-partner-area'` (B05027.ts:88, trigger:'enter')。target は picked scene char、$self無し。DEFERRED-INDEX「PA slot不在」は mr-partner-area-core 出荷で stale。作業: なし (playwright 確認のみ)。
- **B06066** 怪盗キッド＆白馬探: a2「ターン終了時…この能力はパートナーエリアでも発動する」→ `triggered scope:'on-partner-area'` (B06066.ts:69)。a1 (宣言,PA句無し) は `on-scene` のまま (B06066.ts:41) = 正しい (BUG-154 sleepChar self候補懸念は a1 が非PAゆえ gate で到達不能、DEFER "SOLE→MULTI降格" は解消済扱い)。作業: なし。
- **B07039** アン王女: PA句なし (単一 declared ability、cost `partnerAreaRemove` は他カード[ビッグジュエル]を対象、自身の宣言元 scope とは無関係)。DEFER行 = ✅出荷済 (2026-07-09 defer-unlock mini-wave)。作業: なし。
- **B08068** 安室透: 印字に PA句が一切無い (単一 declared, on-scene)。M3 batch 対象として誤収載の可能性。作業: なし。
- **B07015** 遠山和葉＆大岡紅葉: a2「服部平次が登場したとき…この能力はパートナーエリアでも発動する」→ `triggered scope:'on-partner-area'` (B07015.ts:51)。deckRevealUntil chain, $self無し。作業: なし。
- **B08062** 佐藤美和子＆高木渉: a2「〜の場合…この能力はパートナーエリアでも有効になる」→ `type:'continuous' scope:'on-partner-area'` (B08062.ts:70, continuousModifier.apDeltaAura)。read/char.ts:141 で PA-MR bearer の apDeltaAura が scope on-partner-area/always gate 済 (実装確認済、engine既存)。作業: なし。
- **B09002** 工藤新一&毛利蘭: a2「ターン終了時…この能力はパートナーエリアでも発動する」→ `triggered scope:'on-partner-area'` (B09002.ts:81)。chain[handReveal(0枚時chainStepNoApply自動、atom-handlers/core.ts:254-256), sceneSetState] = 「してもよい/そうした場合」正しくgate済。作業: なし。
- **B09070** 萩原千速&萩原研二: a3(ターン終了時 forEach shippuFired)「…この能力はパートナーエリアでも発動する」→ `triggered scope:'on-partner-area'` (B09070.ts:73)。a2(【宣言】【スリープ】レベル9以下リムーブ)はPA句無し→on-scene(B09070.ts:58)= 正しい。BUG-170 (flag清掃境界)は既修正 (step12 batch1)。作業: なし。

## UI_UNLOCKED (declared型 PA scope=正しいが今回のUI基盤が必要だった)

- **B05106** ジン＆ウォッカ: a2「宣言…この能力はパートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B05106.ts:61)。作業: playwright 確認のみ (DSL変更なし)。⚠[NIT 別件] a2 effect が `chain[sceneRemove(0-1選択), draw]` (B05106.ts:245-269)。「してもよい。そうした場合」は本来 `optional{sequence[...]}` idiom (B01069.ts 参照) — sceneRemove の 0選択は chainStepNoApply を立てない (resolve-picks.ts:363 は候補0のみ gate) ため、リムーブを辞退しても draw が発生する card-authoring bug の疑い。PA分類とは独立、engine変更不要 (再authoring のみ)。
- **B06003** 毛利蘭＆江戸川コナン: a2「宣言…パートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B06003.ts:68)。cost selfLpDeltaTurn primitive は同waveで出荷済 (a1のみ使用、a1はPA句無しでon-scene=正しい)。作業: playwright確認のみ。
- **B07065** 世良真純＆メアリー: a2「宣言…パートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B07065.ts:57)。DEFER「MR①②未配線+複数名hard gap」中、MR部分はstale。作業: playwright確認。[NIT] names配列が単一 (rules/19未split、B07065.ts宣言部) — 別件。
- **B05005** 江戸川コナン＆工藤新一: a2「宣言…パートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B05005.ts:67)、charSetTurnEffect targetは相手scene char。作業: playwright確認。
- **B09108** 工藤新一&服部平次: a2「宣言…パートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B09108.ts:64)。DEFER行が明示的に「PA発 human 宣言UI未配線 (PA宣言19 batch)」= 本UI基盤が正にこれ。declareName/fileRemoveTop/fileAdd chain, $self無し。作業: playwright確認 (DeclareCardNameModal + PA宣言の組合せ実機必須)。
- **B05086** 安室透＆降谷零: a2「宣言…パートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B05086.ts:56)、charModifyAP targetは黄キャラ(pick, area既定scene)。作業: playwright確認。
- **B06084** 安室透＆榎本梓: a2「宣言…パートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B06084.ts:60)、draw+souza(相手deck)+conditional discard。作業: playwright確認。
- **B06098** ベルモット＆シェリー: a2「宣言…パートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B06098.ts:52)、deckRevealUntil chain(自deck)。a1(PA句無し)はon-scene=正しい。作業: playwright確認。
- **B06074** 沖矢昴＆世良真純: a2「宣言…パートナーエリアでも宣言できる」→ `declared scope:'on-partner-area'` (B06074.ts:57)、cost fileFrom(FILE) + reserveEffect(turn-end fileAdd)、char対象なし。作業: playwright確認。

## SCOPE_FLIP

- **B05045** 怪盗キッド＆黒羽快斗: a2「宣言…この能力はパートナーエリアでも宣言できる」だが現状 `declared scope:'on-scene'` (B05045.ts:41、コメント「partial-impl…BUG-154」)。実効果は `chain[filePopToHand(FILE→hand), handToFileBottom(hand→FILE)]` (B05045.ts:47-53) で **char対象が皆無** — BUG-154 (mutate/char,scene findChar scene-only) は不成立、self-mutate懸念なし。同方針で保留された B05066 (未登録、a2 declared on-scene のまま) も同型 (相手キャラ対象のみ、self-mutate無し) で同じ理由で解除可能と推測されるが対象外。作業: **B05045.ts:41 の `scope: 'on-scene'` を `'on-partner-area'` に1行変更するのみ** (a1はPA句無しなのでon-scene維持)。engine変更・新規primitive不要。変更後はUI_UNLOCKEDと同じくplaywright確認。

## SMALL_GAP / BLOCKED
該当なし。18件中、新規 engine primitive (verb/cond/dyn) が必要なものは0件。
