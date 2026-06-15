## 赤魔術 family 残 — 【事件赤魔術】族 3枚解禁 (engine変更0)

前セッション (cards/akamajutsu-trait) で 赤魔術 の caseTrait gate + trait データを解禁した上で、
family 残の【事件赤魔術】族 5枚を opus adversarial certify → 3枚解禁・2枚 DEFER。ALL_CARDS 1171→**1174**。

- **certify (opus, workflow)**: 5枚を公式テキスト⇔rules⇔実 engine コードで全句裏取り。3枚 `equivalent/high`、
  2枚 DEFER。certify が **B07038 の import-path build-break を事前検出** (`lookupCardDef` は barrel 非 re-export、
  `@/engine/target/card-def-registry.js` 直 import が正。B09017 先例) — code 前に潰せた好例。
- **解禁 (3枚)**:
  - **B07031 小泉紅子** (SR char): a1=【登場時】`charSetCard{uid:'$self',fromDeckTop}` (このキャラ自身に裏向きセット、
    B08054 同型) / a2=【事件赤魔術】【宣言】`cost pay[sleepSelf, removeFromHand]` (B01088) → sceneRemove(キャラ1枚まで) +
    `optional{chain[charRemoveSetCard n:2, sceneEnter(remove,白L3,1枚まで)]}` (B07055+B07058 合成、reanimate)。
  - **B07038 紅子の執事** (C char): a1=【登場時】reveal-until **closure-OR filter** (カード名[小泉紅子] OR 特徴[赤魔術]event、
    deckRevealUntil は function filter 受理) → handAddFromDeck (forced) → 残りデッキ下 → shuffle →
    conditional(加えた場合){discard 1} / a2=【カットイン】AP＋1000 (D01009 同型)。
  - **B07047 中森銀三** (C char): a1=【事件赤魔術】`caseTraitConditioned` 突撃 (B07052 同型) / a2=【登場時】charSetCard $self /
    a3=【ヒラメキ】キャラ1枚までスリープ (D01012 a2 と byte 等価)。
- **DEFER (2枚)**: **B07034 / PR231** (小泉紅子、text 同一)。a1「セットカードが現場を離れるたび1ドロー」=
  `setcard:leave` per-occurrence hook が engine 不存在 (certify 5点確認: 全 set-card クリア点で emit 無し)。
  a2 単体は実装可だが partial 出荷不可 → カード全体を engine 拡張クラスタへ DEFER。同 hook は B02020 a1 も unblock。
- **このキャラ vs pick の語義差を certify が捕捉**: 「このキャラにセット」= `uid:'$self'` (B08054)、
  「キャラを1枚まで選び…セット」= PA短縮形 (B02023)。混同すると人間経路で誤 pick。
- **gate**: tsc 0 / full vitest **2172** (+12 専用 test) / smoke:1000 winsA=498 baseline不変 (engine変更0・非MVP) /
  playwright 119 / eslint 0 / lint:icon-abilities OK (shipped=1174 deferred=2)。
- 専用 test `akamajutsu-trait-family.test.ts` +12件 (24件総): 突撃 caseTrait gate / charSetCard $self /
  hirameki byte等価 / declared+cost 構造 / charRemoveSetCard n:2→reanimate (human path) + 0枚 chain break /
  reveal-until OR (赤魔術event・名前小泉紅子・不在) / cutin 構造。
- **triage 副産物 (DEFERRED-INDEX)**: TSV category-drop の **実測 blast-radius を決定論 audit** で確定 —
  実装済 event/case を API category と全件突合 → dropped-trait は case 0件 / event 1件 (B06035、既 DEFER) =
  **live 影響ほぼ0**。systemic fix を低 urgency に格下げ (future-proof のみ)。
