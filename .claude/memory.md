# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 7 UI Shell **完了** ✅ (15/15 task land)
**最新コミット**: Phase 7 Task 7.12 TopBar (dual-track pilot #6 final)
**テスト状況**: 1132 PASS / 128 test files / typecheck (src + scripts) クリーン / docs:check クリーン
**ブラウザ表示**: `npm run dev` で 1920×1080 のプレイマット全 12 エリア描画

## 進捗トラッカー

- [x] Phase 0-6: engine + 47 カード + AI (991 tests baseline)
- [x] **Phase 7: UI Shell ✅** (15 tasks, 1132 tests) — 詳細: [sessions/2026-05-15](.claude/sessions/2026-05-15.md)
- [ ] Phase 8: UI Interactions
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 次セッション開始時の最優先タスク

⭐ **Phase 7.5 layout pivot → Phase 8 UI Interactions**

### layout pivot 要望 (Phase 7 完了直前にユーザから受領)

スクリーンショット指示で以下のレイアウト変更要望:

- 右側 ACTIONS パネル (手札の使用 / ネクストヒント / パートナーの能力 / 宣言能力 / 推理 / アクション + AUTO/MAIN/END + END ターン終了)
- FILE を case-col 内 (事件 + 証拠 + FILE の縦 3 段)
- KEEP OUT 撤去
- mat 全体のスペース割り直し

**Phase 8 着手前に layout pivot 専用 commit を入れる**ことを推奨。
Phase 8 のクリック・DnD 配線が現行レイアウトに依存するため、先に layout を確定させる方が回り道が少ない。

詳細プラン: [phase-8-ui-interactions.md](.claude/research/plans/2026-05-11-mvp-implementation/phase-8-ui-interactions.md)

## Phase 7 主要成果

- **12 UI components** 実装 (Playmat / SceneArea / PartnerArea / CaseArea / DeckArea / RemoveArea / FileArea / EvidenceArea / HandZone / TopBar / LogPanel / EffectStackPanel)
- **Zustand store** (gameState ホルダ + dispatcher)
- **tokens.css** (CSS 変数の canonical 定義)
- **cardImage fetch** + 2-tier cache (実画像表示は Phase 8 で URL pattern 確定後)
- **cardResolvers** (CT-D08 + CT-D11 cards.json から ResolvedCardMeta / CaseMeta / HandCardMeta)
- **sampleGameState fixture** (engine 型準拠、12 エリア網羅)
- **App.tsx に Playmat 統合** → `npm run dev` でブラウザ表示

### dual-track ワークフロー (claude.ai Design 併用) 確立

REQUEST.md 形式の依頼書テンプレート + 6 件のパイロット全成功:
SceneArea / CaseArea / FileArea / EvidenceArea / HandZone / TopBar。
Claude Design が版権配慮を自発的に判断 (原作キャラ名回避)、engine 型と完全互換 or 軽微 adapter で統合可能。

## Phase 6 申し送り (Phase 7+ で対応)

1. **Heuristic policy 改善**: handUseCard を reasoning より優先する priority 見直し
2. **assist trigger 厳格化**: `evidence >= required - 2` 条件追加推奨
3. **endTurn turnFlags reset**: match.ts 手動呼び出し → 内部自動化検討

## 過去セッションログ

- [2026-05-10](.claude/sessions/2026-05-10.md) — 法務・ルール・MVP決定
- [2026-05-11](.claude/sessions/2026-05-11.md) ほか — Phase 0-3
- [2026-05-12](.claude/sessions/2026-05-12.md) — Phase 4-5
- [2026-05-14](.claude/sessions/2026-05-14.md) — Phase 5 fix + Phase 6
- [2026-05-14-2](.claude/sessions/2026-05-14-2.md) — Obsidian × Engine 統合
- [2026-05-15](.claude/sessions/2026-05-15.md) — **Phase 7 UI Shell 完了**

## 主要参照

- [.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md)
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
