## meta-app(5174): Master Duel 風デッキビルダー全面リデザイン + 同ID3枚ルール是正 + 画面ルール準拠

**Round/Phase**: 2026-06-06 session — meta-app(localhost:5174) UI/処理のルール準拠化。
ユーザー報告バグ (同IDパラレルが3枚制限を回避) の修正と、カード編集/リスト画面の Master Duel 参考リデザイン。

### ルール是正 (rules/02-deck-construction)

- **BUG-125**: カード同一性を cardNum → **cardId** に是正。`CardDef.id` 追加 (`cardPool.toCardDef` で保持)、
  `cardIdOf`/`countsByCardId` 追加。`validateDeck` と `DeckEditor.addCard` の3枚上限を cardId 集計化。
  47印刷=34種(13組パラレル)を正しく同一視。実機 `isPlayable` ゲートも是正され違反デッキの投入を遮断。
- **BUG-126**: `SAMPLE_DECK_OPP` の事件カード D11021×3 混入を除去 (題材キャラ3枚化で40維持)、
  `validateDeck` に事件(type=case)拒否を追加。`DeckRecord.case`(事件スロット)を新設し検証・編集・実機に配線、
  `decksStore` v2 マイグレーションで旧デッキに case をバックフィル。

### カード編集 (DeckEditor) — Master Duel 風リデザイン

- 3パネル (プール↔デッキ↔詳細)、共有 `FilterRail` (色/種別/コスト/レアリティ/特徴/キーワード, OR/AND, sticky)。
- パートナー・事件スロットの選択UI、新規/複製/削除デッキ (従来は常にサンプル上書きの不具合)。
- 同ID上限の **UI 可視化**: プールタイルに `n/3` バッジ + 到達でグレーアウト+「MAX 3」、詳細に「同 ID 上限」注記。
- ダブルクリック/右クリック/±で追加除去、自動グルーピング ⇔ 手動ドラッグ並べ替え。
- **デッキコード入出力** (CONAN1: base64, MD に無い機能)、**テストハンド5枚** ドロー。

### カードリスト (CardsScreen) — リデザイン

- 「種類」を distinct cardId (34) に是正、パラレルまとめトグル、CATALOG (偽の100%カバレッジを廃止)。
- 名前/効果/番号/特徴 検索、AP/LP 等ソート、★お気に入り/採用中 フィルタ、グリッド大/小+リスト表示。
- `MetaCard` にキーボード操作 (role/tabIndex/Enter/Space) を付与 (a11y)。

### 画面外のルール準拠

- `ResultScreen`: 先攻/後攻の必要証拠数を engine `requiredEvidence`(7/6) 直読に (ターン偶奇推測を廃止)。
  `MatchRecord` に対戦種別(solo/observe)・相手デッキ名を記録。
- `customGameStart`/`SetupScreen`: 観戦モードで人間マリガンを抑止、先攻トグル(P1/P2/ランダム)を実機に反映。
- `HomeScreen`/`SetupScreen`/`DeckList` の「種類」を cardId 単位に統一。

### 検証

- typecheck clean (meta-app) / eslint 0 errors (既存 Button.tsx 空interfaceも是正)。
- e2e (meta) 非tutorial **26 pass**: deck.spec(5: MAX可視/クリック→同ID上限/パラレル合算追加→4枚目ブロック/
  v1→v2 migration修復/デッキコード) / cards.spec(改修4) / filter-decoy.spec(2: §7 色facet decoy除外) /
  smoke 全10ルート console error 0 / golden-path 実機対戦 / engine-stub。
- card-addition-checklist §7「画面処理=文言」を deck-builder に適用: 同ID上限の追加→兄弟絵柄MAX→ブロックを
  実機で踏破、facet フィルタの decoy 除外を実機検証、スクリーンショット目視確認。
- **自己レビュー (敵対的多エージェント, 5次元×検証)**: 10指摘→8確定(1重複)→7修正/2 refuted。
  migration修復不足(高)/お気に入りcardId不整合(中)/_matchMeta stale(中)/FilterRailカウント×2/折畳ハイライト/
  未知num受理(低×4) を同セッションで修正 ([[BUG-127]] / [[BUG-126]] 追記)。
- node 実証: 違法パラレルデッキ・事件混入が NG、サンプルデッキ2種が OK。
- 既知 flaky: tutorial「Esc で viewer」(1/3 pass、tutorial/router 未変更、遷移タイミング競合、本変更と無関係)。

### 新規/変更ファイル (meta-app 内のみ、engine/cards 非干渉)

- 新規: data/cardFilter.ts, state/filtersStore.ts, shared/FilterRail.tsx, util/deckCode.ts, tests/e2e/deck.spec.ts
- 変更: data/{types,cardPool,sampleDeck}.ts, state/{decksStore,metaStore}.ts, stubs/engineStub.ts,
  util/customGameStart.ts, shared/{MetaCard,Button}.tsx, screens/{DeckEditor,CardsScreen,SetupScreen,ResultScreen,HomeScreen}.tsx
