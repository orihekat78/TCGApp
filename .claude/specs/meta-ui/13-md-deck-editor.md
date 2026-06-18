# 13. MD風デッキ編集画面 リデザイン (設計)

> 2026-06-16 承認。`meta-app/src/screens/DeckEditor.tsx` の **render(レイアウト)のみ** を
> 遊戯王マスターデュエル風 3 ペインに刷新する。**ロジック/state/ハンドラ/検証は全て現状流用・挙動不変**。

## 目的
- デッキ中身を「テキスト行リスト」→「**カード画像グリッド**」化。
- 3 ペイン: **左=選択カード詳細 / 中央=デッキ / 右=手持ち(プール)**。MD リファレンス準拠。

## レイアウト (flex、ウィンドウ全幅充填)
- 上部 toolbar: 現行 SubToolbar 流用 (deck名/selector/新規/複製/削除/コード/テスト/未保存/保存/キャンセル)。
- **左ペイン (~290px) 詳細**: 大カード(click→`CardExpandModal` 拡大) + 名前/種別/特徴 + C/AP/LP + 効果文 + [－][n/3][＋]。現行 CardDetailPanel の内容を流用。
- **中央ペイン (flex) デッキ**: 上部に パートナー/事件スロット(`SlotPickerModal` 流用) + 40/40・種類数 + cost曲線 + 種別内訳 + 検証バナー。下に **40枚のカード画像グリッド** (1タイル+×nバッジ、type→cost→name 自動整列)。
- **右ペイン (flex) 手持ち POOL**: ヘッダに 🔍検索 + 並べ替え▼(num/cost/ap/lp/name) + 「フィルタ N」ボタン。下にプールのカード画像グリッド。**フィルタは slide-over パネルで既存 `FilterRail`** を表示 (②の黒白/混色/facet無効化が有効)。

## 操作 (ハイブリッド)
- 手持ちカード **click = 即追加 + 詳細表示** (上限到達は atMax で灰・追加不可)。
- デッキカード **click = 詳細表示**、**削除は タイルの－ボタン(ホバー表示)**。詳細ペインの ＋/－ も併用。
- カード**拡大**は **左詳細ペインの大カード click** で行う (`CardExpandModal`、②CardsScreen と同方式)。デッキ/プールのグリッドカードの click は 追加(pool)/詳細(deck) に割当、拡大とは競合しない。

## 流用コンポーネント / ロジック (変更なし)
- `MetaCard` / `FilterRail` / `FilterGroup` / `CardExpandModal` / `SlotPickerModal` / `DeckCodeModal` / `TestHandModal` / `WarningBanner` / `DeckStats`。
- `addCard`/`removeCard`/`setPartner`/`setCase`/`loadDeck`/save/dirty/validation(engineStub)/`cardIdOf`/`countsByCardId`/sticky filters。

## スコープ調整
- **手動並べ替え(D&D)廃止** → 自動整列のみ + 並べ替えキー選択 (MD準拠、グリッドD&Dは操作性難)。
- 新規実装: デッキグリッド / プールヘッダ(検索+並べ替え+フィルタボタン) / フィルタ slide-over。

## ルール反映 (rules/)
- rules/02: デッキ = パートナー1 + 事件1 + 40枚。EXデッキ概念なし → パートナー/事件は固定スロット。
- rules/02: 同 cardId 3枚上限 (`countsByCardId`、parallel 合算)。検証は engineStub 流用。
- rules/06: パートナー/事件はデッキ本体に入れられない (プール typeOptions = character/event)。

## エッジケース
- 手札0/デッキ0枚 (新規デッキ): グリッド空表示 + 検証エラー表示。
- 同ID上限到達: pool タイル灰・追加不可、deck タイル ×3 表示。
- パートナー/事件未選択: 検証エラー、スロットは空表示 (＋)。
- 混色/黒白カード: ② のフィルタが slide-over 内で正しく動作。
- 1042枚プール: `loading=lazy` + フィルタで絞る。重ければ仮想化を follow-up。

## 検証 (Playwright 実機)
追加/削除/上限/パートナー事件選択/検証OK・NG/デッキコード入出力/テストハンド/デッキ切替/
フィルタ popover(黒白・混色・facet無効)/並べ替え/カード拡大/保存・dirty を全て実機で確認。
複数ビューポート幅で 3 ペインが崩れず充填。console error 0。typecheck/eslint green。

## 関連
- [07-screens-library.md](07-screens-library.md) — 現行 DeckEditor 仕様
- [02-design-system.md](02-design-system.md) — トークン/共通コンポーネント
- ②の色/facet 修正 (commit 703be43f)、①盤面 fluid (bc8e8ce2)
