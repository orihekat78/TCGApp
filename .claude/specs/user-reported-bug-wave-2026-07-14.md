# User-reported bug wave 2026-07-14

## 目的・裁定

10件をT3で修正する。公式ルールVer 2.4を基準に、表示とGameStateを同じdecisionへ接続する。

- `rules/03`: 証拠・FILE・リムーブは独立エリア。所有者側も内容閲覧UIを提供する。
- `rules/08`: コンタクトは低AP側からカットイン/変装/パスを選び、終了時にcontact効果を切る。
- `rules/09`: カットインは手札から1枚、解決後リムーブ。変装は状態・付与効果を引き継ぐ。
- `rules/15`: 「1枚まで」は0枚可。発動済み効果は発動元離場後も解決する。
- `rules/20`: 効果登場でも現場上限時はスイッチを扱う。
- `rules/21`: 宣言能力は宣言とコスト支払い後に解決する。
- `rules/25`: 前段mutation後の状態で後段を評価。発動済み効果は能力無効後も残る。

## GameState → UI

| State/decision | UI owner | 完了条件 |
|---|---|---|
| browse evidence/remove | CardListModal (`origin=browse`) | ユーザーが閉じる |
| pending deck reveal pick | full-window CardListModal | 対象選択または辞退 |
| pendingDeckReorder | DeckReorderModalHost（最優先） | 順序確定 |
| pending sceneEnter(area=hand) | HandZone pick mode | 選択/辞退、必要ならswitch |
| human contact decision | HandZone + decision controls | cutin/変装/pass |
| partner contact AP | common effective-AP reader | judge後scope clear |

decision modalはreorder > deck-window pick > hand sceneEnter > generic picker。各pendingはUI ownerをちょうど1つ持つ。

## 実装レーン

1. UI: BUG-189〜193、198。modal origin/priority、B04026全chain、contact手札確認、AI待機分類。
2. Engine: BUG-194、197。partner AP state/read/mutate/clear、元能力suppression共通reader。
3. Cards: BUG-195、196。shared choice除去、B04018/P共通3能力builder。
4. 統合: Solが型・UI・resolverを統合し、Luna機械監査、Sol敵対レビューを行う。

## エッジケース

- ゼロ件: 公開候補0、hand登場候補0、cutin候補0でも辞退/pass可能。
- 不可逆: デッキ下順序は確定前に後続pickを操作できず、確定後だけmutationする。
- 状態相互作用: 現場5枚からの効果登場はswitchを要求する。
- 負値: partner APへ負補正を適用し、判定・表示で同一値を使う。
- 連鎖: B04026の公開→取得/辞退→並べ替え→手札登場を順に完走する。
- 重複: 同一cardId複数枚でも選んだoccurrenceだけ移動する。
- 境界: B04018はLv5可、Lv6不可。ターン終了で能力無効/AP補正を清掃する。
- 変装: 付与済み効果と状態は継承し、印字能力のsuppression scopeも継承する。

## 検証・水平展開

focused Vitest、targeted Playwright、typecheck、lint群、docs:check、全test、smoke:1000、benchmarkを実行する。
deckReveal利用カード、全pick host、単一option choice、通常/P variant、CardDef直読み、actor AP読取、step timerを横断監査する。

## 保留・既知の限界

- 19:39のコスト8リムーブはカードID不明。推測修正・BUG登録しない。
- 19:31の元事象はログ不足。確定したpartner AP欠落だけBUG-194として修正し、再現継続時は別票にする。
