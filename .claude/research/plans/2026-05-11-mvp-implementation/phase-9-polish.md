# Phase 9: 統合・自動プレイテスト1000戦・チュートリアル

**Goal:** MVP として実用できる状態へ。安定性確認・チュートリアル・README 整備。

**Files:**
- Create: `tests/integration/playtest-1000.test.ts`
- Create: `src/ui/tutorial/{index,Step1Movement,Step2Reasoning,Step3Action,Step4Contact,Step5SolveCase}.tsx`
- Modify: `README.md` (実行手順)
- Test: `tests/integration/*.test.ts`

---

### Task 9.1: 自動プレイテスト 1000戦

- [ ] テスト: Heuristic vs Random で 1000戦
- [ ] レポート出力 (`reports/playtest-YYYY-MM-DD.md`):
  - 0 例外
  - 0 invariant違反
  - 平均ターン数
  - 勝者分布 (片方が勝率 90%+ なら AI バランスを再考)
  - 敗北原因 (deck-out vs 勝利条件)
- [ ] 失敗時: バグ修正 → 再実行

### Task 9.2: パフォーマンス計測

- [ ] テスト: 1試合 100ms 以内 (engine のみ、UI 抜き)
- [ ] ボトルネック特定 + 必要なら最適化

### Task 9.3: チュートリアル (5ステップ)

[research/tutorial/](../../../research/tutorial/) 参照

- [ ] Step1: 移動・状態理解
- [ ] Step2: 推理→証拠獲得
- [ ] Step3: アクション (キャラ・事件)
- [ ] Step4: コンタクト・カットイン
- [ ] Step5: アシスト→事件解決→勝利

### Task 9.4: README 更新

- [ ] 実行手順 (`npm install` → `npm run dev`)
- [ ] 法務スタンス再掲
- [ ] 既知の制限 (CT-D08+CT-D11 のみ・時間制限なし・MR将来)
- [ ] 開発者向け (cards/_shared 規約・骨格凍結原則)

### Task 9.5: 設定画面

- [ ] AI ポリシー切替 (Random / Heuristic)
- [ ] アニメーション速度 (1x / 2x / off)
- [ ] ログ詳細度
- [ ] テスト

### Task 9.6: 最終ユーザー受入テスト

- [ ] チェックリスト:
  - [ ] 起動 → ゲーム開始 まで 30秒以内
  - [ ] 全47カード が手札・現場で正しく表示
  - [ ] 全 8 共通クラスがカード適用済
  - [ ] チュートリアル完走可能
  - [ ] AI 1000戦 PASS

### Task 9.7: 実装ガバナンス: 月次レポート雛形

- [ ] `reports/monthly-template.md`:
  - 骨格 LOC / PR 数
  - 共通クラス変更数
  - 新カード touched files 平均
- [ ] CLAUDE.md 数値ターゲット表と整合

### Task 9.8: タグ + リリース判定

- [ ] `git tag v0.1.0-mvp`
- [ ] CHANGELOG.md 初版
- [ ] ユーザー判定: Phase B (CT-D02 以降の追加カード) へ進む or 安定化

## 完了基準 (MVP リリース判定)

- ✅ 人 vs CPU 1試合 動作
- ✅ AI 1000戦 0 例外
- ✅ チュートリアル 5ステップ完走
- ✅ rules/01〜30 全項目カバー (実装・テスト両面)
- ✅ 47枚 全カード動作
- ✅ README 整備
- ✅ 月次レポート雛形

→ MVP 完了。次は CT-D02〜D07 等の他デッキ拡張 / MR 拡張 / オンライン対戦 (将来)
