# 作業ログ — 名探偵コナンTCG プロジェクト

> 当日の詳細 (session①BUG-143/144+cluster8 / ②BUG-145 / ③赤魔術family / ④family残) は
> [sessions/2026-06-15.md](sessions/2026-06-15.md)。changelog-entries 2026-06-15-01〜05 に各 Phase 記録済。

## 2026-06-15 セッション④ — 赤魔術 family残 (cards/akamajutsu-family-2)

session③ で 赤魔術 caseTrait gate + trait データ解禁 → 本 session で family残【事件赤魔術】族を certify→実装。

### 成果 (全 gate green, ALL_CARDS 1171→1174)

- **triage**: TSV category-drop の **実測 blast-radius を決定論 audit** で確定 (実装済 event 76/case 65 を
  API category と全件突合 → dropped-trait は case 0 / event 1=B06035 既DEFER = **live 影響ほぼ0**)。systemic fix 低 urgency 化。
- **certify (opus workflow)**: 5枚→3 equivalent/2 DEFER。certify が B07038 import build-break + 「このキャラ($self) vs pick」語義差を code 前に検出。
- **解禁3枚**: B07031 (登場時 charSetCard$self + 宣言[caseTrait赤魔術, cost pay[sleepSelf,removeFromHand]] →
  sceneRemove + optional{chain[charRemoveSetCard n:2, reanimate remove白L3]}) / B07038 (登場時 reveal-until
  closure-OR[名前小泉紅子 OR 赤魔術event] → handAdd → デッキ下 shuffle → 加えたら discard1 + cutin AP+1000) /
  B07047 (caseTrait突撃 + 登場時 charSetCard$self + hirameki sleep=D01012 byte等価)。
- **DEFER 2枚**: B07034/PR231 (text同一)。a1「セットカードが現場を離れるたび1ドロー」= `setcard:leave` per-occurrence
  hook が engine 不存在 (certify 5点確認)。partial 不可→engine拡張クラスタ。同 hook は B02020 a1 も unblock。
- gate: tsc 0 / full vitest **2172**(+12) / smoke winsA=498 baseline不変 / playwright 119 / eslint 0 /
  lint:icon-abilities OK (shipped=1174 deferred=2)。専用 test 24件総 (+12)。

### branch / 残

- branch `cards/akamajutsu-family-2` で commit → main ff-merge → push → CI 確認。
- 次候補: `setcard:leave` hook engine拡張クラスタ (B07034/PR231 + B02020 a1 解禁) / B07005 action-restriction /
  observer contact-removal attribution (D02008/B05066) / B08078 外部 hook 発火。
