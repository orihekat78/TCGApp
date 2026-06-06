# 2026-06-06 — meta-app(5174) Phase 18: Master Duel 風デッキビルダー全面リデザイン + 同ID3枚ルール是正

別ワークストリーム (engine/cards タスク A/C とは独立、変更は **meta-app/ + .claude/ のみ**、engine/cards 不可触)。
ユーザー指示: localhost:5174 の UI/処理をルール準拠化、カード編集/リスト画面を **遊戯王マスターデュエル参考**に
リデザイン (実UX調査必須)、既知バグ「同IDでも絵柄違いでデッキ登録でき3枚制限を無視」を修正、UI上で確認可能に。

## ステータス
**完了・検証済み**。typecheck clean / eslint 0 / meta e2e 非tutorial **26 pass** / 回帰0。コミット&プッシュ実施。

## 実施内容
1. **基盤**: `CardDef.id`(cardId) 追加 + `cardIdOf`/`countsByCardId`/`DISTINCT_CARDS`/`defaultCaseForPartner`/
   `variantsOfId` (cardPool.ts)。`DeckRecord.case`(事件スロット) 追加 + decksStore **v2 マイグレーション**
   (case backfill + 旧サンプルの不正データ修復)。カード同一性を cardNum→**cardId** に是正 (47印刷=34種/13パラレル組)。
2. **validateDeck**: 3枚上限を cardId 集計化 / 事件・パートナーのデッキ内拒否 / 事件1枚必須 / 未知num拒否。
3. **共有フィルタ**: data/cardFilter.ts (述語/ソート) + state/filtersStore.ts (sticky 永続) +
   shared/FilterRail.tsx (色/種別/コスト/レアリティ/特徴/キーワード, OR/AND)。
4. **DeckEditor 全面リデザイン**: 3パネル / パートナー・事件スロット選択 / ×n/3バッジ+到達グレーアウト「MAX 3」/
   ダブル・右クリック・±追加 / 自動整列⇔手動ドラッグ / 新規・複製・削除 / デッキコード入出力 / テストハンド5枚。
5. **CardsScreen 全面リデザイン**: 種類=cardId(34) / パラレルまとめ / CATALOG (偽の100%廃止) / 効果テキスト検索 /
   AP/LPソート / ★・採用中フィルタ / リスト表示 / MetaCard キーボードa11y(role/tabIndex/Enter/Space)。
6. **画面外ルール準拠**: ResultScreen を engine.read.player.requiredEvidence(7/6) 直読化 + MatchRecord に種別/相手名 /
   customGameStart 観戦モードのマリガン抑止 + deck.case 使用 + 先攻トグル実機反映 / Home・Setup の種類 cardId 化。

## 調査 (workflow / 多エージェント)
- **監査** (5エージェント並列): IDバグ影響範囲・各画面ルール準拠・カードリスト表示・デッキ編集UX・検証完全性。
- **Master Duel UX 研究** (多ソース cross-check): 3パネル/facet(特徴=アーキタイプ)/decoy除外/デッキコード(MD欠点克服)/
  テストハンド等 → 本ゲーム制約 (40+パートナー1+事件1, extra/sideなし, 色制限は対戦時のみ) へマッピング。
- **自己レビュー** (敵対的 5次元×個別検証, 10指摘→8確定(1重複)→**7修正**/2 refuted)。

## バグ (記録系・全て修正済)
- **[BUG-125](../bugs/BUG-125.md)** (高): cardNum単位3枚制限で同cardIdパラレルが6枚入る (ユーザー報告)。cardId 是正。
- **[BUG-126](../bugs/BUG-126.md)** (高): SAMPLE_DECK_OPP に事件D11021×3混入 + validateDeck 事件未拒否 +
  migration 修復不足 (既存v1ユーザーへ違法カード残存→Setup回帰/tutorialがルール違反対戦開始)。
- **[BUG-127](../bugs/BUG-127.md)** (中): リデザイン回帰群 — お気に入りcardId不整合/_matchMeta stale persist/
  FilterRailカウント母集団ズレ×2/パラレル折畳ハイライト消失/未知num受理。

## 検証 (card-addition-checklist §7 を deck-builder に適用)
- e2e: deck.spec(5: MAX可視 / クリック→「同ID上限」 / パラレル合算 追加→兄弟MAX→4枚目ブロック /
  v1→v2 migration修復 / デッキコード) / cards.spec(改修4) / filter-decoy.spec(2: §7 色facet decoy除外) /
  smoke 全10ルート console error 0 / golden-path 実機対戦 / engine-stub。スクリーンショット目視確認も実施。
- 既知 flaky: tutorial「Esc で viewer」(1/3 pass、tutorial/router 未変更、遷移タイミング競合、**本変更と無関係**)。

## engine への申し送り (骨格凍結で out of scope)
`src/engine/flow/setup.ts` validateDeck も per-cardNum 集計で同じ3枚穴あり (mainCards を cardId 集計すべき)。
本修正は meta-app の検証ゲート(isPlayable)で違反デッキの実機投入を遮断済。

## 関連
- バグ集約 view: [.claude/bugs/index.base](../bugs/index.base)
- changelog エントリ: [2026-06-06-17-meta-app-md-deckbuilder.md](../changelog-entries/2026-06-06-17-meta-app-md-deckbuilder.md)
- メモリ: meta-app-parallel-id-bug / master-duel-ui-reference
