# Phase 7: UI Shell + プレイマット

**Goal:** [ui-overall.md](../../../specs/2026-05-11-ui-overall.md) と [ui-state-mapping.md](../../../specs/2026-05-11-ui-state-mapping.md) に従い、プレイマットレイアウト・各エリアコンポーネント・selector hooks を実装。**操作系は Phase 8**。

**Files:**
- Create: `src/ui/state/{store,selectors}.ts` (Zustand + engine state ホルダ)
- Create: `src/ui/components/{Playmat,SceneArea,PartnerArea,CaseArea,DeckArea,FileArea,EvidenceArea,RemoveArea,HandZone,TopBar,LogPanel,EffectStackPanel}.tsx`
- Create: `src/ui/styles/{tokens.css,playmat.css,animations.css}`
- Test: `tests/ui/components/*.test.tsx` (Vitest + @testing-library/react)

---

### Task 7.1: Zustand store (engine state ホルダ + dispatcher)

- [ ] テスト: store.gameState 取得・更新
- [ ] 実装: `useGameStateStore` (engine state を保持・dispatch で mutation 適用)

### Task 7.2: スタイルトークン ([ui-style-tokens.md](../../../specs/2026-05-11-ui-style-tokens.md))

- [ ] CSS variables (--c-bg, --c-card-back-blue, etc.)
- [ ] カードサイズ階層 (XS/S/M/L)
- [ ] フォント・色・余白規定
- [ ] テスト: storybook サンプル

### Task 7.3: Playmat レイアウト (1920×1080 / 最低1280×720)

- [ ] グリッド (8 areas × 自他陣)
- [ ] 相手陣 180度回転
- [ ] テスト: スナップショット (vitest snapshot)

### Task 7.4-7.13: 各エリアコンポーネント

各 task: コンポーネント + props + selector hook + スナップショットテスト

- [ ] 7.4 SceneArea (5枚スロット)
- [ ] 7.5 PartnerArea (1枚 + MR用)
- [ ] 7.6 CaseArea (事件カード + マーカー)
- [ ] 7.7 DeckArea (枚数表示)
- [ ] 7.8 FileArea (積み重ね表示)
- [ ] 7.9 EvidenceArea (裏向き積み + クリック展開モーダル: ui-modal-flows-other)
- [ ] 7.10 RemoveArea (枚数 + クリックで一覧)
- [ ] 7.11 HandZone (フラット表示 MTGA型)
- [ ] 7.12 TopBar (フェイズ・痕跡・必要証拠数・効果スタック数)
- [ ] 7.13 LogPanel (下端折りたたみ)

### Task 7.14: EffectStackPanel + 状態オーバーレイ

- [ ] 効果スタック件数バッジ
- [ ] active/sleep/stun の回転+バッジ表現 (ui-mr-and-special)
- [ ] 名乗り状態バッジ
- [ ] テスト

### Task 7.15: カード画像実行時フェッチ + キャッシュ

- [ ] 公式 URL から imagePath 経由で取得
- [ ] localStorage / memory cache
- [ ] フォールバック (取得失敗時の placeholder)
- [ ] テスト: モック fetch

## 完了基準

- 全 16 UI specs ファイルの **静的部分** がレンダリング可能
- ダミー GameState を渡せばプレイマットが描画される
- 操作不可 (Phase 8 で実装)

→ Phase 8 へ
