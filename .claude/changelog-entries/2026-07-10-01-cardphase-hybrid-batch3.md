### CARD PHASE hybrid-batch3 — refuse-line pipeline 13 printings (engine変更0)

- **13 printings 出荷**: B01047 黒羽快斗 / B01081 安室透 / B03003 灰原哀 / B03024 / B05022 「オレがついてる!!」 /
  B05068 / B06062 / B06078 / B06104 カッ / B08025 / B08076 (case) / B01023 + twin D10024。
  hybrid pipeline (prepare 40 unit → workflow author=opus / verify=sonnet5 → finish 一気通貫 → gen:probes + 手書き probe)。
- **歩留まり 12 EQ + 1 twin / 40 unit (30%)** — pool の尾が硬化 (26 unit が真 engine-gap DEFER、
  DEFERRED-INDEX「hybrid-batch3 由来」節 + `.tmp/_batch3_defers.txt` に file:line 根拠全文)。
  mini-wave 候補 cluster 5 件抽出 (turn-scope LP override / bound levelSum dyn / deck-reveal 拡張 / cost choice UI / faceUp setCard)。
- **tooling 改良**: finish.cjs BUG-130 lint を rider-only hard に精緻化 (standalone uid:'$pick'+target は
  shipped 正準形 149 files → WARN) / validate-specs SCOPES に 'on-set-host' 追加 (stale whitelist、
  B01039/B05041/B07014 稼働済) / probe harness に setup.deckTop + setup.evidence 追加
  (cost removeDeckTop・deckRevealUntil・flipFaceUpEvidence の内容依存シナリオ対応)。
- gates: tsc 0 / vitest 4382→**4418** pass +1 skip (probe +36) / smoke winsA=472 不変 exceptions=0 / 8 lint err0 / crosscheck 14/14。
