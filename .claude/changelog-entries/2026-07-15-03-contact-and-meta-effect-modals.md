## コンタクト表示とMeta効果モーダル修正 (2026-07-15)

### Fixed

- カットイン使用・パス後に展開された手札が残る表示を修正。
- Meta対戦画面でB09056/Pなどの任意効果が選択待ちのまま見えない問題を修正。
- 対戦画面だけに出ていた開発用ナビゲーションHUDを非表示化。

### Changed

- 5173/5174の効果決定modal host集合を共通化し、choice、intercept、RPS、set-card、deck reorder/placeを含む10種の構成ずれを解消。

### Verification

- B09056/Pの赤パートナーFILE中の条件成立、コンタクト使用/パス、Meta対戦画面の任意効果操作を回帰テスト。
- full Vitest 5,788件、smoke/benchmark各1,000戦、typecheck、lint、docs、side-channel lintが成功。
