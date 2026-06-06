## タスク C: event→evidence PR 再録 12 枚 (selfToEvidence 完成度ギャップ解消、engine 変更0)

**Round/Phase**: 2026-06-06 session — event→evidence engine ユニット (f8526b97) の adversarial review が検出した
完成度ギャップ (PR 再録 12 枚未実装) を解消。engine 変更なし・既存 selfToEvidence verb の再利用のみ。

### 対応カード (12 枚)

- **PR012-021** (10 枚): B04015/B04028/B04041/B04062/B04086 の PR 再録 2 セット (青/緑/白/赤/黄 × 2 絵柄)。
  各 base カードを `{ ...B04xxx, id, no, rarity:'PR', imageUrl }` で spread (B01094P 同パターン、能力 shape 同一)。
- **PR062 / PR066** (2 枚): 「RUM!!」(黒, Lv7)。PR062 を full def で実装、PR066 は `{ ...PR062, ... }` spread。
  selfToEvidence を **黒** イベントにも適用 (verb は色非依存、handUseCard の色制限は事件色で gate)。

### 検証

- typecheck clean / 全 vitest **1822 pass / 0 fail** (回帰0) / registry・generated-batch test pass /
  ALL_CARDS 943→**955** (重複 ID なし)。
- engine 変更0 のため新規 engine テスト不要 (selfToEvidence は f8526b97 で unit/e2e 検証済)。

これで event→evidence の selfToEvidence パターン (イベント自身を表向き証拠化) は **全 17 枚実装完了**。
残る hand→evidence (裏向き, B06033 等) / 相手証拠操作 (B05103) は別 verb で DEFER。
