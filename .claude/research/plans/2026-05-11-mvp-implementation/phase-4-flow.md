# Phase 4: Flow Control (turn/phase/action/contact/setup)

**Goal:** [engine-api-flow-control.md](../../../specs/engine-api-flow-control.md) + [-contact.md](../../../specs/engine-api-flow-contact.md) + [-setup.md](../../../specs/engine-api-flow-setup.md) を実装。フェイズ駆動・メイン6行動・アクション9段階状態機械。

**Files:**
- Create: `src/engine/flow/{turn-phases,main-actions,reasoning,action-state-machine,contact,action-case,guard,setup,target-expander}.ts`
- Test: `tests/engine/flow/*.test.ts`

---

### Task 4.1: setup (init / decideFirstPlayer / dealOpeningHand / mulligan / reveal / startGame)

- [ ] テスト: setup.init → mulligan → reveal → startGame で turn=1 / firstPlayer 決定 / requiredEvidence=7|6 (rules/01, 04)
- [ ] テスト: マリガン2回試行は拒否 (mulliganUsed フラグ)
- [ ] エッジ: デッキ40枚未満で例外
- [ ] commit

### Task 4.2: runAutoPhase (3ステップ自動処理 + 先攻初手 FILE1枚例外)

- [ ] テスト: パートナー active / キャラ active / draw1 / FILE2 (先攻初手のみ FILE1)
- [ ] テスト: スタンキャラは sleep に変化 (rules/03)
- [ ] エッジ: パートナー FILE 移動中なら戻して active (rules/05)

### Task 4.3: メイン6行動 canX/doX

- [ ] テスト (per action):
  - handUseCard (色制限+1ターン1回+ネクストヒント実施ターン不可 rules/05/12/20)
  - runNextHint (FILE 必要+登場キャラ named:true rules/12)
  - usePartnerAbility (active 必須)
  - useDeclaredAbility (cost 含む rules/21)
  - doReasoning (LP≤0 で 0枚 rules/11)
  - canAction (名乗り例外: 突撃/突撃[X]/迅速 rules/13)
- [ ] commit per action

### Task 4.4: アクション状態機械 (declared→guard-window→leave-resolution→contact-pending→1→2→1-redo→judge→end)

- [ ] テスト: 各 phase 遷移
- [ ] テスト: ガード前の離場でアクション終了 (rules/07)
- [ ] テスト: 【現場リムーブ時】はガードと コンタクト発生 の間 (rules/22)
- [ ] テスト: コンタクト発生「後」に「コンタクトしたとき」効果発火
- [ ] テスト: AP参照タイミング = snapshotAP → contact:before-judge

### Task 4.5: contact (cutIn / disguise / pass / judge / computeOrder)

- [ ] テスト: 1コンタクト1枚 (cutin/disguise) (rules/23)
- [ ] テスト: 変装の引継ぎ table (rules/23)
- [ ] テスト: AP判定 (≧でリムーブ・同値もリムーブ・攻撃キャラリムーブされない rules/08)
- [ ] テスト: ブレットならガード不可 (rules/13)
- [ ] テスト: 行動順 (AP低い側1番目, 同値で非ターンプレイヤー1番目 rules/08)

### Task 4.6: actionCase (証拠1リムーブ → ヒラメキ判定窓 → 自証拠+1)

- [ ] テスト: rules/10 の3ステップ
- [ ] テスト: ヒラメキ持ちなら判定窓
- [ ] テスト: 攻撃キャラが現場離脱しても証拠獲得まで進む (rules/10)

### Task 4.7: guard (candidates / canGuard, ブレット例外)

- [ ] テスト: active 必須・名乗り OK・AP条件なし

### Task 4.8: target expander / mustBeTargeted (G29/G28)

- [ ] テスト: D11007 「レベル7以上アクティブを指定可」 (registerTargetExpander)
- [ ] テスト: D11005 挑発 (mustBeTargeted=true で対象固定)
- [ ] commit

### Task 4.9: 統合テスト (1ターン完走)

- [ ] シナリオ: 設定→ターン1オート→メイン (推理1, アクション1)→エンド
- [ ] 全 invariant 通過確認
- [ ] commit

## 完了基準

- ゲーム1試合 (空 deck でも) が完走
- アクション+コンタクト 9段階全網羅
- カバレッジ ≥ 85%

→ Phase 5 へ
