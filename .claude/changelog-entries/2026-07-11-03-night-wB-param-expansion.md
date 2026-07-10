## 夜間自走 Wave B — engine param 拡張 9 rep + exemplar 13 printings (1935→1948)

- **pick/query (WB1)**: toPartnerArea pick 化 (B07030/B07061) / sceneEnter partner-area∪remove union
  source (B09055) / sceneSetState dyn-max ({dyn} は既存動作と実証 — degenerate max≤0 抑止のみ追加、
  B03063) / distinctLevel query (distinctNames 同型 9 site、B09105 card は fileRemoveTop exact-N gate
  待ちで DEFER) / baseLpMin-Max filter (元LP 判定、B09011)。
- **trigger/dyn (WB2、4/4)**: $declared pre-walk deferral + deckRevealUntil maxN dyn (B09112+P) /
  enter payload sourcePlayer + enterSource side (「自分のキャラの能力や効果によって登場」、
  B05009+P/D10022) / triggerCharMatches requireSource (「このキャラを指定してアクション」、B01070) /
  B05075 (engine 変更 0 — stale DEFER)。
- **T2 混成 review**: BLOCK 1 = B05075 a1 が「してもよい」を bare chain で実装し human の decline 権を
  剥奪 (rules/15 違反、D04007 の optional idiom が正) → optional wrapper 化 + decline probe 追加。
  NIT = B09011P 欠落 → 補完。
- DEFER: B06027 (前提不成立 — evidence card は hirameki 解決時点で remove に居る、設計判断要) /
  B09105 card (fileRemoveTop exact-N chain-break 別 primitive)。
- gates: tsc 0 / vitest 5333+ / smoke 472 exc0 / lint err0 / probe wB1 26 + wB2 41。**1948 / 2074 = 残 126**。
