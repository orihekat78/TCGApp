# feat(cards): CARD PHASE step12 batch1 — mega-wave 解禁 consumer 15枚 + BUG-170 修正

- **日付**: 2026-07-04
- **種別**: カード追加 (15枚) + engine バグ修正 (BUG-170、骨格バグ修正 exception)
- **カード**: B04072 白鳥任三郎 / B03046 怪盗キッド / B08014 毛利蘭 / B09090 風の女神 /
  B01058 トッ / B08069 風見裕也 / B03126 犯人 / B02088 犯人 / B07026 相応しいお方 /
  B05042 ラブリースポット / B08026 大滝悟郎 / D10005 ハート姫（毛利蘭） / B07014 弁当型携帯FAX /
  B01039 「かっ…和葉ァ!!!」 / B09070 萩原千速&萩原研二 (MR)

## 内容

mega-wave W1〜W6 で出荷済の engine primitive 群の first-consumer 一括刈り取り (step12 batch1)。
22 候補を sonnet5 grounding workflow (per-card 全句⇔engine token 突合) で審査し、CLEAN 15 枚を author。

初 consumer となった primitive: untargetableByActionAura (B04072) / opponentRestrict
stunAutoActivate (B03046) / selectedByOwnMr (B08014) / setShippuWaive (B09090) /
reserveEffect next-match・turn-end (B01058/B08069) / colorIgnoreOnHandUse・
setEvidenceGainSuppress (B03126/B02088) / eventUseSource (B07026) / useEventFromHand
(B05042/B08026/D10005) / on-set-host declared rider + removeAreaToDeckTop (B07014) /
leave:intercept kept-in-scene (B01039) / shippuFiredCharThisTurn forEach (B09070)。

**BUG-170** (first-consumer probe が検出): 「このターン中に〜した」履歴 flag (selectedByOwnMr /
shippuFiredCharThisTurn) が endTurn の clearTurnEffects で turn-end queue 解決より先に消え、
B08014/B09070 の印字条件が常に空振りする race。清掃を startTurn 境界へ移動して修正
(「〜まで」持続効果は従来通り endTurn 清掃 — 区別基準を BUG-170.md に収録)。

## DEFER (grounding で判定、DEFERRED-INDEX「step12-batch1」節)

- B06020 (a1 hand-scope cutin aura 機構不在) / B06042 (charGrantAbility が declared type を
  強制 triggered 化 + findDeclaredAbility が grantedAbilities 非走査) / B06085 (evidenceGain
  faceUp arg 不在 — 軽微 additive 候補) / B09112 (resolveEffectPicks pre-walk が {dyn} を
  declareName 実行前に literal 化 → sceneNameCount 常に 0、実測実証)
- B09108 / PR105 / B09003 = DSL 部品は全出荷済だが DeclareCardNameModal UI 配線 (human の
  カード名指定供給) が未配線 — batch2 で配線 + 3枚一括 author 予定

## 検証

- probe: tests/cards/step12-batch1.test.ts 49 tests (実 def 第2gate 再certify、decoy 同居)
- vitest full green / smoke:1000 winsA=472 不変 / typecheck 両 tsconfig / 混成 review
  (sonnet5 semantic + opus edge)
