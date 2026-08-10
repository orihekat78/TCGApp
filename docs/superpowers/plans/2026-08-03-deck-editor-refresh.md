# デッキ編集画面刷新 実装計画

## Task 1: 画面契約を失敗テストで固定

Files:
- Modify: `meta-app/tests/e2e/deck.spec.ts`

Steps:
1. poolクリックが枚数を変えず詳細dialogを開くテストを追加。
2. pool→deckのdrag/dropが1枚追加するテストを追加。
3. 同一ID上限時のdrop拒否とlive通知を追加。
4. 詳細の追加/削除ボタンが同じmutationを使うテストを追加。
5. 851×393で2領域、drawer、overflow、44px操作を検証。
6. 対象テストを実行し、現行UIでREDになる理由を確認。

## Task 2: 既存状態契約を保った構造刷新

Files:
- Modify: `meta-app/src/screens/DeckEditor.tsx`
- Modify: `meta-app/src/styles/meta.css`

Steps:
1. `AppTopBar` を `PrimaryHeader` に置換し、画面root/操作列/作業面をclass化。
2. 常設詳細列を除き、デッキ面70%・カード一覧30%へ再構成。
3. poolカードのclickを選択+drawer openへ変更。
4. pool card wrapperにHTML5 drag sourceを追加。
5. deck paneにdrop targetを追加し、既存 `addCard` へだけ接続。
6. 追加結果を返す小さなmutation resultと`aria-live`通知を追加。
7. 既存保存、取消、filter、sort、modal、validatorを維持。

## Task 3: 左詳細ドロワーと入力代替

Files:
- Modify: `meta-app/src/screens/DeckEditor.tsx`
- Modify: `meta-app/src/styles/meta.css`
- Modify: `meta-app/tests/e2e/deck.spec.ts`

Steps:
1. kind別statsを使う詳細ドロワーを実装。
2. close/Escape/backdrop/Tab trap/focus returnを実装。
3. 44pxの追加・削除ボタンと常時利用可能なdeck削除操作を実装。
4. right-click拡大、parallel ID合算、unlimited契約を維持。
5. REDテストをGREENにする。

## Task 4: 表示・回帰検証

Files:
- Modify if needed: `meta-app/tests/e2e/deck.spec.ts`

Steps:
1. focused deck E2E、typecheck、lint、buildを実行。
2. 1440×900、851×393でconsole、overflow、drop、focus、保存/取消を確認。
3. deck全E2E、Cards/HOME/SETUP smoke、full Vitestを実行。
4. `git diff --check` と構造的類似箇所を横断確認。
5. product design、UX、visual QA、敵対的レビューでCritical/Importantゼロにする。
