# YOU-vs-CPU row 055 attempt 1 — active checkpoint

- Pairing: `deck-1785077473170` (黒カットイン) vs `deck-1785077473170` (黒カットイン), desktop public UI, fresh tab started from `#setup`.
- State: 先攻 T3. Self evidence 0/7; CPU evidence 3/6. Self FILE 5; CPU FILE 4. CPU public board: バーボン L2 AP1000, キール L2 AP1000.
- Completed public actions: selected all initial cards (キャンティ No.1063, キール No.0836, ラム No.0716 x2, バーボン No.1038) for the one permitted mulligan. Replacement public hand: ウォッカ L5 x2, ヘルエンジェル L6, キャンティ L3 and L7, バーボン L7.
- Completed public actions: T1 ended with no playable card. T2's only legal cards were キャンティ L3 and キール L2; no action was consumed. T3 deployed ウォッカ L5 AP5000 cost0 and accepted its public optional deck-removal effect. The UI publicly revealed three black cut-in cards, granting ウォッカ `突撃`.
- Result: BLOCKED — public UI stall. T3: ウォッカ(突撃)でバーボンをアクションしリムーブ。再度アクションで自分シェリーを選んだが、残る公開キールは対象として反応せず、UIは `アクション対象 の対象を選択してください。` のまま。終了ボタンも無効で、取消操作は提供されなかった。
- Decision grounds: hidden state・直操作・リロードでの強制進行は使わない。公開UI停止としてこの試行を固定する。
- Exact retry: increment runtime failure count, open a fresh tab at `#setup`, choose only row055の黒カットイン対黒カットイン, and replay from public UI. Do not navigate directly to `#match`.
- Exact restart action: in the already-open row-055 public-match tab, click `ターン終了`, confirm the visible end-turn dialog, then wait for public state. Do not inspect face-down cards or navigate directly to `#match`.
