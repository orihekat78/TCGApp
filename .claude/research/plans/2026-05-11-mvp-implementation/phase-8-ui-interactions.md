# Phase 8: UI 相互作用 + 動的モーダル + ゲームループ統合

**Goal:** [ui-action-flows.md](../../../specs/2026-05-11-ui-action-flows.md) + [ui-modal-flows-contact.md](../../../specs/2026-05-11-ui-modal-flows-contact.md) + [-other.md](../../../specs/2026-05-11-ui-modal-flows-other.md) + [ui-game-setup-flows.md](../../../specs/2026-05-11-ui-game-setup-flows.md) を実装。クリック+確認 UX (Q8 MTGA型)・厳格確認 (Q9)。

**Files:**
- Create: `src/ui/interactions/{click-pick,confirm-modal,target-selector,...}.tsx`
- Create: `src/ui/modals/{Contact,CutIn,Disguise,Guard,Misread,Hirameki,Souza,Switch,Setup,Mulligan,FirstPlayerPicker,SolveCase,Reasoning,Action,...}.tsx`
- Create: `src/ui/hooks/{useEngineDispatch,useTargetPicker,useConfirmation}.ts`
- Test: `tests/ui/integration/*.test.tsx` (E2E感)

---

### Task 8.1: useEngineDispatch (UI → engine action 委譲)

- [ ] テスト: dispatch('reasoning', {uid}) で state 更新
- [ ] 実装: Zustand action

### Task 8.2: useTargetPicker (Q8 クリック+確認 UX)

- [ ] テスト: candidate ハイライト → クリック → 確認 → resolve
- [ ] エッジ: 0枚選択可スキップ

### Task 8.3: useConfirmation (Q9 厳格モーダル)

- [ ] 全行動で「実行/キャンセル」確認

### Task 8.4: ゲーム開始モーダル (Setup → Mulligan → FirstPlayer → Reveal → StartGame)

- [ ] テスト: シーケンス完走

### Task 8.5: メインフェイズ操作 UI

- [ ] 6行動ボタン (canX で活性)
- [ ] 推理 (キャラクリック→確認)
- [ ] アクション (キャラクリック→対象選択→確認)
- [ ] 手札使用 / ネクストヒント / 宣言能力 / アシスト

### Task 8.6: コンタクトモーダル (cutin / disguise / pass)

- [ ] 9段階状態機械の各段で適切モーダル
- [ ] 1番目 / 2番目 / 1番目再行動 の順序強制

### Task 8.7: 各種モーダル (ガード / ミスリード / ヒラメキ / 捜査 / スイッチ)

- [ ] 各 ui-modal-flows-other に従い実装

### Task 8.8: 効果スタック解決 UI

- [ ] 同所有者順序選択 (drag&drop or 番号付け)
- [ ] 解決中ロックインジケータ

### Task 8.9: AI ターン進行表示

- [ ] AI が思考中アニメ
- [ ] アクションログをリアルタイム表示

### Task 8.10: アニメーション ([ui-animation-specs.md](../../../specs/2026-05-11-ui-animation-specs.md))

- [ ] 標準 0.3-0.5秒
- [ ] スキップ可

### Task 8.11: 統合 E2E (人 vs Random AI 1試合手動)

- [ ] テスト (Playwright もしくは手動): フルゲーム完走
- [ ] バグ検出 → 修正

## 完了基準

- 人 vs CPU で1試合完走
- 全モーダルが ui-* spec 通り動作
- 操作中に invariant 違反なし

→ Phase 9 へ
