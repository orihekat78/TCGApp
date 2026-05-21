## user_request 20260521_01 triage Phase α + β (2026-05-22)

ユーザー指摘 18 件のうち **13 件解決**。

### Fixed
- `9567c0c` BUG-037 SceneArea.css animation fill-mode (sleep CSS、#1 / #16)
- `152253d` BUG-038 仕様外 close (BUG-037 で間接解決、#7)
- `d823f7f` BUG-040 Playmat.tsx `declaredTargetCount` ハードコーディング修正 (declared ability、#15)
- `a96f900` BUG-041 `canUse` に switch fallback 追加 (hand-use switch、#13)
- `cd2d161` BUG-043 HandZone 右クリック → CardExpandModal (hand expand、#8)
- `5ffed7c` BUG-044 heuristic に reasoning vs case attack スコア比較、「劣勢時 disruption only」(AI case attack、#4)

### Added
- `db0cd9b` BUG-042 GameSetupModal にデッキ選択 dropdown 追加、`buildDeckPair({selfDeckId, oppDeckId})` 新 API (deck select、#17)

### Changed
- `8d33d03` Phase α 6 件 (#2 #5 #6 #10 #11 #14): 公式裁定確認 + 運用 doc 整備
  - `.claude/docs/user-request-clarifications.md` 新設 (#5 解決編 / #6+#14 NH は公式 PDF p.12-13 引用で「現実装が正しい」と確定)
  - `.claude/specs/DEFERRED-INDEX.md` / `.claude/bugs/README.md` 新設
  - CLAUDE.md「効率より精度」方針追加 (#2)

### Notes
- **主要パターン発見**: BUG-040/041/042/043 すべて「engine + flow + picker は完成しているのに Playmat.tsx の prop 配線漏れで UI 側だけ動かない」同一 pattern (4 件)
- 残 5 件は規模大で別セッション (#3 contact UI driver / #9 E2E / #12 AI speed slider / #18 audit umbrella)
