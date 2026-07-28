# Row 028 attempt 1 -- public UI in progress

- Pair: YOU and CPU `deck-1784115404288` (黒赤デッキ), desktop P1. Fresh visible
  `#setup`; no direct match recovery, dispatch, injection, pending/state read,
  or face-down identity inspection.
- Status: setup. Next: set both visible deck selectors to 黒赤デッキ, keep YOU
  as P1, then start and make all decisions from the rendered public UI.

## Start and restart point

- Visible setup completed for P1/P2 黒赤デッキ and P1 first. Mulligan returned
  duplicate バーボン No.1038 two copies to seek lower-level deployment; retained
  カッ No.0721, バーボン No.0390, and ジン No.1037. New public hand is カッLv7,
  バーボンLv7 x2, ジンLv2/Lv8, キールLv8; no legal T1 card at FILE1.
- Status: `in-progress`, YOUR T1 MAIN. Empty scenes, evidence 0/7 vs 0/6,
  FILE1, hand6, no modal. Next: normal end turn; then evaluate the first legal
  early 黒赤 deployment from the rendered hand.

## Decisions and result

- T1: no legal card at FILE1; ended normally. CPU T1 played Lv2/AP1000
  バーボン and reached evidence1/6.
- T2: FILE3のLv2/AP1000ジンを展開。T3はFILE5のLv2/AP1000ベルモットを追加。どちらも公開操作パネルの行動候補は`待機中`で、盤面選択による攻撃開始フィードバックはなし。
- CPU T3: evidence3/6、毒島桐子AP3000を公開盤面へ。CPU T4でevidence6/6、Lv7/AP6000迅速バーボンを追加、解決編へ。強制手札リムーブは重複イベント「カッ」1枚を選択。
- T4: FILE7でLv7/AP6000迅速バーボンを展開。自盤面はジン1000、ベルモット1000、バーボン6000。行動候補は引き続き`待機中`。通常終了後に結果画面。
- Outcome: `DEFEAT`、理由`必要証拠数達成`。YOU P1敗北、証拠0/7。CPU P2勝利、証拠6/6。ターン数8。CPU MVPはバーボンD07006、貢献AP6000。
- 使用カード・能力: ジンLv2、ベルモットLv2、バーボンLv7迅速。CPUはバーボンLv2、毒島桐子、バーボンLv7迅速、ミステリーコースターを公開確認。
- UI所見: 結果はCPUが必要証拠6/6到達後、次の通常終了で表示。3体展開後も公開操作パネルの行動候補は`待機中`。規則不一致とは断定しない。

## Completion

- Status: `clean-public-seed-unverifiable`。公開UIのみで正常完走。seedは公開UIから検証不能。次はrow 029を可視`#setup`から開始する。
- Verification: 結果画面後のbrowser console errorは0件、`git diff --check`通過。runtime packetは既存行と同じdirty worktree保護により未実行。
