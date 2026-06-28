## engine additive: `$self.setCardCount` dyn token (B05030 fully faithful)

- `src/engine/dyn/eval.ts` の `resolveSelf` に **`$self.setCardCount`** 分岐を additive 追加
  (`scene.byUid(state, uid)?.setCards.length ?? 0`)。このキャラに (裏向き/表向き) セットされた
  カード枚数を読む dyn token。`setCards.length` は静的 state field ゆえ ap/lp の continuousDelta
  再帰経路を踏まない (BUG-156/157 と無縁)。dyn token は sync registry を持たないため honor site は
  resolveSelf 単一。
- **B05030 遠山銀司郎** の主眼 a2「【自分ターン中】このキャラにセットされているカード1枚につき AP+1000」を
  解禁し fully faithful 化 (従来は dyn token 不在で a1 のみの partial-ship)。D08005 a1 (faceUpEvidence)
  同型の継続修飾 (`continuousModifier.apDelta = { dyn: '$self.setCardCount * 1000' }`, condition `turn:self`)。
- 挙動不変ゲート: tsc0 / vitest 0 fail / smoke:1000 winsA=498 exceptions=0 (既存カードは本 token 未使用 =
  機械保証) / 8 custom lint OK。専用 test: dyn eval (set 0/1/N + decoy: 他 char / stackedCards 非計数) +
  B05030 integration (自ターン AP=5000+set×1000 / 相手ターン bonus 0 / stacked 非計数)。
