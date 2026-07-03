### engine mega-wave W2: restriction/observer 6 primitive + hook + exemplar 3 printings (2026-07-03)

全カード実装計画 第2弾 (W1 = additive verb/cost に続く restriction flags クラスタ)。

**新 primitive (engine):**
- ContinuousModifier 4 token (P07/r24): `untargetableByAction` (target-expander.candidates 負 filter) /
  `caseActionBan` (canActionAgainstCase gate) / `selfActionBan` (_canAction gate) /
  `selfCutinBanInContact` (canCutIn 参加キャラ gate)。reader = `read.char.selfContinuousFlag`
  (continuousDelta の boolean 版、condition honor rules/24)。
- `opponentRestrict` union += **'refreshEvidence'** (P08/r25: deck.refresh の penalty 証拠 push のみ抑止、
  reshuffle/痕跡/remove:exit 不変 rules/14) + **'hirameki'** (G09/r29: handleEvidenceRemovedHook aura gate、
  証拠リムーブは継続・ヒラメキ効果のみ不発 rules/10)。
- `colorIgnoreOnHandUse` (P09/r26): 「手札から使用する場合、事件カードの色を無視できる」。
  `handUseColorIgnoreAllowed` 単一ソース helper — colorAllowed の subset 失敗時のみ委譲 (通常カード
  ゼロコスト)。engine 2 site (hand-use-card/next-hint) + UI 2 site (flows.toCandidate/handUseReason) 鏡像。
- 新 hook **'ability:declared'** (宣言能力使用の第三者観測、B03057)。emit = declared-ability
  宣言成立時 (コスト支払後)。matcher = triggerCharMatches/triggerPlayerIs。

**exemplar 3 printings (dormant 解禁):**
- B05079 世良真純 — 突撃[事件] printed + 「相手は【ヒラメキ】を発動できない」(opponentRestrict:'hirameki'
  初 consumer) + ヒラメキ evidenceFlip max2 faceDown。
- B03057/B03057P 槍田郁美 — 「スリープ状態の場合…指定してアクションできない」(condition{charStateIs sleep}
  + untargetableByAction、スタン時は不成立 = 公式Q&A) + 「[探偵]が【宣言】能力を使用したとき draw+discard」
  (ability:declared hook 初 consumer)。

**engine-only (consumer は co-primitive 待ち、DEFER):** refreshEvidence の B05097 (可変数 removeDeckTop cost
待ち)、colorIgnoreOnHandUse の B03126 (P40 action-evidence-deny 待ち)。W2 spec の「既存」主張 2 件
(ability:declared hook / action-evidence-deny) は実測で偽と判明 → hook は本 wave で追加、deny は defer。

**検証:** TDD probe 11 tests (RED→GREEN、on/off 両 assert + 方向逆 assert + スタン/スリープ区別)。
gates: tsc0 / vitest 3831→3845 / smoke:1000 winsA=498 exceptions=0 不変 / lint errors=0 /
敵対 review = **sonnet5+opus 混成 2 lens** (2026-07-03 モデル規約改定の初運用)。
