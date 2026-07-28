# YOU-vs-CPU row 055 attempt 2

- Pairing: 黒カットイン vs 黒カットイン。attempt 1の公開UI停止後、fresh `#setup` から再開。
- State: 先攻 T1。自分 evidence 0/7、CPU 0/6、自分 FILE 1、CPU FILE 0。両者パートナーはシェリー。
- Completed: 初手のバーボン、ウォッカx2、キャンティ(No.1063)、キャンティ(No.0825)を全交換。交換後の公開手札はキャンティL7、バーボンL2、ベルモット&シェリーL9x2、ヘル・エンジェルL6、ウォッカL5。
- Decision: T1・T2はカード詳細表示だけを閉じて終了。T3でCPUが進行し、T4の公開効果 `手札から1枚選んでリムーブしてください` に対して公開手札のキャンティを選択した。
- Result: BLOCKED — 選択後にキャンティはリムーブ領域へ移動したが、同じ選択要求が残留し、`ターン終了` は無効。効果スタックは0で、公開UIから取消・確定操作は提供されなかった。
- Decision grounds: 隠し状態参照、dispatch、直状態変更、`#match` 直遷移、リロードによる強制進行は使わない。
- Exact retry: runtime failure countを増やし、fresh tabで `#setup` を開く。row055の黒カットイン対黒カットインだけを選び、公開UIから再試行する。
