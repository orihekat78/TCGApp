### engine mega-wave W1: additive verb/cost 5 primitive + exemplar 9 printings (2026-07-03)

**全カード実装計画 (2026-07-03 ユーザー決定: blocked 全解禁まで engine 拡張続行) の第1弾。**
85-primitive TSV を origin/main 実測で再 grounding (34 SHIPPED / 51 未出荷、workflow 6-agent) →
additive クラスタ W1 を一括出荷。

**新 primitive (engine):**
- `charSetCard deckOwner:'picked-host'` (field) — セット元デッキを picked host の持ち主側に。
- `charSetCard cardIds` remove-source 分岐 — remove pick → host 裏向きセット、0枚 = chainStepNoApply
  (「セットした場合」gate)。remove:exit emit 付き。
- cost `revealHandToDeckTop` — 手札公開→デッキ上 (canPay=candidates≥n、pay=hand.remove+deck.toTop)。
- verb `sceneToEvidence` — 現場キャラ→**所有者の**証拠 (faceUp 指定、rules/16 set リムーブ + MR① redirect parity、
  mutate.scene.toEvidence 新設)。
- verb `handToFileBottom` — 手札→FILE **1番下** に表向き (mutate.file.insertBottomFaceUp = unshift、rules/05)。
- verb `evidenceToDeckBottom` — 証拠 pick→持ち主デッキ下 (リムーブでない=ヒラメキ不発動 rules/10)。

**exemplar 9 printings (dormant 解禁):**
- PR136/PR142 伊織無我 — 絆LP+1 + パートナー緑突撃 + コンタクト除去 observer→持ち主デッキセット
  (removedCharMatches by:'self' + deckOwner:'picked-host')。
- B08036 クリス・ヴィンヤード — 宣言スリープ: remove 工藤有希子セット→「セットした場合」sceneToDeck + ヒラメキ sleep。
- B05049/B05049P 中森青子 — cost revealHandToDeckTop(怪盗キッド) + 黒羽快斗へ突撃 turn 付与 (rules/19 分割名 Q&A 準拠) + ヒラメキ。
- B03084/B03084P 降谷零 — 登場時 sequence[evidenceToDeckBottom, sceneToEvidence Lv7↓ 表向き] + 宣言 捜査1
  bind $found → boundAnyMatchesFilter{levelMin:5} → AP+2000。
- B05045/B05045P 怪盗キッド＆黒羽快斗 (MR/MRP) — removeDeckTop5 cost + sceneToDeck apMax8000 +
  chain[filePopToHand, handToFileBottom] + カットイン AP+2000。PA宣言句は B05066 前例の partial (BUG-154)。

**検証:** TDD probe 22 tests (atom 11 + card 11、RED→GREEN、human 経路 applyPickAndContinuation +
production trigger 経路 removeToRemove 実 emit + chain gating + decoy filter)。
gates: tsc0 / vitest 3809→3831 (+22) / smoke:1000 winsA=498 exceptions=0 不変 / eslint 0 / 8 lint errors=0 /
opus 2-lens 敵対 review (semantic + edge)。
