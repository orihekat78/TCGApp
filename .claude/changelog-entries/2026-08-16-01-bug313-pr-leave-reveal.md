## BUG-313 — PR135/PR141 現場リムーブ時能力の復元

- PR135/PR141へ、相手ターン中の自己離場で阿笠博士まで公開するa2を追加。
- 一致カードの強制取得、残りの順序保持、デッキshuffleを公式文どおり実装。
- public dispatchで発火制約、match/no-match、owner mirror、短いデッキrefreshを回帰。
- 6件の公式QAをexact evidenceへ接続し、BUG-311静的familyを34定義へ拡張。
