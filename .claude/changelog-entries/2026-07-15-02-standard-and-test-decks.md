## 公式標準デッキ修正とテストデッキ追加 (2026-07-15)

### Fixed

- `少年探偵団・標準`と`警察・標準`を公式CT-D08/CT-D11の40枚構成へ修正。
- 保存version 3 migrationで標準2件だけ更新し、ユーザー作成デッキは保持。
- smoke/benchmarkの重複レシピを廃止し、共通builder参照へ統一。

### Added

- Meta UIと対戦builderのexact-list回帰、v2移行E2E、同ID上限E2Eを追加・更新。
- ブラウザへ`TEST-バグ波-緑`、`TEST-コンタクト`、`TEST-無制限0627`を追加。

### Verification

- full Vitest 5,787件、Meta deck E2E 9件、typecheck、lint、smoke 1000が成功。
