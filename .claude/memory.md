# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 7 + Phase 7.5 layout pivot **完了** ✅
**最新コミット**: `cded622` Phase 7.5 mat grid 再構造化 (現場下に 証拠+パートナー、対称配置)
**テスト状況**: 1131 PASS / 128 test files / typecheck (src + scripts) クリーン / docs:check クリーン
**ブラウザ表示**: `npm run dev` で全 13 エリア (ActionsPanel + opp-hand-strip + narrator-msg 含む) 描画

## 進捗トラッカー

- [x] Phase 0-6: engine + 47 カード + AI (991 tests baseline)
- [x] **Phase 7: UI Shell ✅** (15 tasks, 1132 tests) — 詳細: [sessions/2026-05-15](.claude/sessions/2026-05-15.md)
- [ ] Phase 8: UI Interactions
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 次セッション開始時の最優先タスク

⭐ **Phase 8 (UI Interactions)** 着手

詳細プラン: [phase-8-ui-interactions.md](.claude/research/plans/2026-05-11-mvp-implementation/phase-8-ui-interactions.md)

### Phase 8 完了後の TODO (layout polish 申し送り)

Phase 7.5 で大枠の layout は揃ったが、ユーザ参考画像との **完璧な視覚一致は未達成**。
Phase 8 完了後にもう 1 ラウンドの layout polish を入れる予定:

- カード画像実フェッチ + 表示 (silhouette → 実画像) — Task 7.15 API 利用、URL pattern 確定後
- 動的 actionMode (engine 状態連動、対象選択中のハイライト等)
- 学生 (操作ヒント) tooltip の動的生成
- mat 内部の細かい寸法調整 (現状画像比 80% 程度の一致)
- 「現場の下 = 証拠 + パートナー」の比率や spacing の微調整
- カード詳細モーダル・ネクストヒント・アシスト確認モーダル等の追加

ユーザの参考スクショは記録残し: 各 dual-track の REQUEST.md +
Phase 7.5 polish commit (`bf73360`) + layout refactor (`cded622`) を参照。

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

## 次セッション開始用プロンプト

⭐ **[sessions/NEXT-SESSION-PROMPT.md](.claude/sessions/NEXT-SESSION-PROMPT.md)** — 新セッションで最初に貼り付けるテンプレート

## 過去セッションログ

- [2026-05-10](.claude/sessions/2026-05-10.md) — 法務・ルール・MVP決定
- [2026-05-11](.claude/sessions/2026-05-11.md) ほか — Phase 0-3
- [2026-05-12](.claude/sessions/2026-05-12.md) — Phase 4-5
- [2026-05-14](.claude/sessions/2026-05-14.md) — Phase 5 fix + Phase 6
- [2026-05-14-2](.claude/sessions/2026-05-14-2.md) — Obsidian × Engine 統合
- [2026-05-15](.claude/sessions/2026-05-15.md) — **Phase 7 UI Shell 完了** (session 1)
- [2026-05-15-2](.claude/sessions/2026-05-15-2.md) — **Phase 7.5 layout pivot** (session 2)

## 主要参照

- [.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md)
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
