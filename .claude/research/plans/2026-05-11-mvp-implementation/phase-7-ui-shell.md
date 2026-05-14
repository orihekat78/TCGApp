# Phase 7: UI Shell + プレイマット

**Goal:** [ui-overall.md](../../../specs/2026-05-11-ui-overall.md) と [ui-state-mapping.md](../../../specs/2026-05-11-ui-state-mapping.md) に従い、プレイマットレイアウト・各エリアコンポーネント・selector hooks を実装。**操作系は Phase 8**。

## レイアウト参照資産

**視覚の正:** `design-mockups/01-board-mockup.html` (1984行, 1920×1080)。各 task は下表の DOM/CSS 行範囲・class を as-is で抽出。**ルール挙動の正:** specs + rules ([README warning](../../../../design-mockups/README.md))。挙動衝突=spec、視覚衝突=mock。

| Task | DOM 行 (opp / self) | CSS 行 | 主要 class |
|---|---|---|---|
| 7.2 tokens | — | 6-44 (`:root`) | `--bg-*`, `--state-*`, `--neon-blue`, `--color-{blue,yellow,red,green,purple}` |
| 7.3 Playmat | 1208-1606 | 44, 253, 329-351, 1202 | `.scaler`, `.stage`, `.play-area`, `.mat.self`, `.mat.opp` (180°回転), `.zone` |
| 7.4 SceneArea | 1326-1356 / 1452-1483 | 377, 460-478 | `.scene-col.scene-zone`, `.scene-slots`, `.card.color-*`, `.slot-empty`, `.zone-watermark` |
| 7.5 PartnerArea | 1358-1378 / 1484-1505 | 358 周辺 | `.partner-col.partner-zone`, `.partner-slot`, `.zone-watermark-keyhole` |
| 7.6 CaseArea | 1299-1311 / 1425-1437 | 516, 517, 561, 578 | `.case-zone`, `.case-card.portrait`, `.case-stamp`, `.evidence-required` |
| 7.7 DeckArea | 1380-1392 / 1506-1518 | 652, 657, 682 | `.deck-col.deck-zone`, `.deck-stack > .layer.{l1,l2,l3,top}`, `.deck-count` |
| 7.8 FileArea | 1394-1405 / 1520-1531 (+modals 1885-1980) | 704, 489, 589, 639 | `.zone.file-strip`, `.stack-display.file`, `.file-modal` |
| 7.9 EvidenceArea | 1312-1322 / 1438-1449 | 589, 639 | `.evidence-zone`, `.stack-display.evidence`, `.card-back`, `.count-overlay`, `.progress-track` |
| 7.10 RemoveArea | 1407-1418 / 1533-1544 | (zone 共通) | `.zone.remove-col`, `.stack-display` |
| 7.11 HandZone | 1552-1601 | 893, 899 | `.hand-zone`, `.hand-card.color-*`, `.hand-card.featured`, `.hand-card.disabled` |
| 7.12 TopBar | 1213-1235 | 72-104 | `.topbar`, `.chapter-tag`, `.scratch.found`, `.effect-stack`, `.narrator-avatar` (※フェイズは `.phase-bar` 1243-1247 / CSS 124-143 — TopBar 外) |
| 7.13 LogPanel | 1236-1241 (button のみ) | 145-163 | `.log-btn` — **mock に下端パネルなし。spec の "下端折りたたみ" を実装、閉時のみ `.log-btn` 視覚を流用** |
| 7.14 EffectStack/状態 | 状態: 1338,1346,1462,1472,1491; バッジ: 1221 | `.card.sleep` 457, `.card.stun` 460, `.named-badge` 465, `.set-badge` 474, `.effect-stack` 97 | sleep=`rotate(-90deg)`, stun=`rotate(180deg)`+赤シャドウ. パネル本体は mock 外 — spec 実装 |
| 7.15 画像fetch | — | — | mock の `.silhouette` プレースホルダを `<img>` 差替え。失敗時 `.silhouette` フォールバック |

**Mock 限定 (lift 必須):** `.bg`(23-41 5層), `.vignette`(42), `.opp-hand-strip`(260, 1282-1294), `.action-indicator`(1296,1422), `.zone-watermark{,-keyhole}`, `.scaler`(1202,1208).
**Mock 削除済 → spec 採用:** `.keep-out` は mock で `display:none !important` (298行)、Task 7.3 で復活。
**`02a/02b/03/04`-*.html は Phase 8 参照** (推理フロー / VS / モーダル / アニメ) — Phase 7 では使わない。

### 視覚デザインワークフロー (dual-track, 2026-05-15 追加)

視覚タスク (7.3-7.14) は **Claude Design (Research Preview)** で視覚プロトタイプ → Claude Code で型・selector・テスト統合の二段構え。非視覚タスク (7.1, 7.2, 7.15) は Claude Code 単独で並列進行。Task 7.4 SceneArea でパイロット検証中、問題なければ 7.5 以降へ展開。最終検証は Playwright MCP で mock vs 実装の screenshot 比較。

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
