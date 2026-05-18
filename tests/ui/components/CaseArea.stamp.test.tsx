// Phase 8.10h: CaseArea stamp-flip class application
// Round 3: case-stamp は事件カードから削除 (edition tag が Playmat 側に独立配置)。
//   旧 test (stamp class application) は意味を失ったため skip 化 + 説明コメント残置。
//   regression 担保は Playmat 側の .case-edition-tag.resolved class test で代替予定。

import { describe, it } from 'vitest';

describe.skip('CaseArea — 解決編 stamp class (Round 3 で削除)', () => {
  it.skip('case-stamp 自体が削除済 — Playmat.case-edition-tag.resolved で代替テスト', () => {});
});
