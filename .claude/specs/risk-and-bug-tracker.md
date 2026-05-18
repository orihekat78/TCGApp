# リスク・バグ管理 — 名探偵コナンTCG MVP

最終更新: 2026-05-18 (Round 4a)

## 個別バグエントリ

個別バグエントリは [.claude/bugs/](../bugs/) に各 BUG-XXX.md として分解管理。
集約 view は **[.claude/bugs/index.base](../bugs/index.base)** を Obsidian で開いて参照
(表示 view: 全バグ一覧 / 🔴 重大バグ / 🔧 Round 4a / ⏳ 未着手 / cards view)。

新規バグ発見時: `.claude/bugs/BUG-XXX.md` に frontmatter (`id`, `severity`, `category`, `status`, `round`, `date_found`) を付けて作成すれば自動的に Base view に反映される。

---

## 運用方針 (CLAUDE.md §設計レビュー §水平展開 連動)

- 全バグ・リスクを `.claude/bugs/` に Obsidian Base 形式で記録 (Round 4a で導入)
- 新規 PR で該当 bug ファイルを更新する規約 (Round 4a Phase 6.4 で CLAUDE.md に追記)
- 各 entry に **RCA (根本原因)** / **水平展開結果 (同種バグ)** / **防止策** を必ず記述
- カテゴリ (engine / UI / メタ / 機能 / パフォーマンス) と重大度 (重大 / 高 / 中 / 小) で分類

---

## RCA: なぜ Round 1-3 で多数の重大バグが見逃されたか

ユーザ実プレイ (2026-05-18) で 10 件の指摘が発覚。重大 engine バグ 5 件 (BUG-005/006/007/008/009) の発見漏れ原因:

### 観察事実

| バグ | 既存実装 | 既存 test | 検出不可だった理由 |
|------|---------|----------|--------------------|
| BUG-006 action[事件] 証拠変動なし | engine 関数完成 | engine 単体 test のみ | **UI dispatch 層を経由した end-to-end test 欠如**。actionJudge case branch の case-target 分岐の到達性が test されていない |
| BUG-009 FILE 7+ で解決編移行せず | `mutate.case.toResolved` 関数あり | toResolved 単体 test あり | **「条件達成時の自動遷移」を検証する integration test 欠如**。assist 後の FILE 長 自動チェックが呼出元で欠落 |
| BUG-005/007 triggered ability 不発 | カード定義に trigger.hook あり | カード単体 test は effect 構造のみ | **「hook 発火時に listener 登録されているか」検証する test 欠如**。listener は 2 hook のみ対応、他 7+ hook は noop |
| BUG-008 イベントカード手札に残る | character 分岐のみ | character の test あり | **kind='event' 分岐が存在しない**。if 文網羅性チェック (switch-case) も不在 |
| BUG-001/002/010 UI 課題 | - | - | ユーザが何度も指摘しないと優先度が上がらない構造、Round 2/3 で「枝葉」扱い |

### Round 1-3 のレビュー機能不全の真因

1. **Playwright 検証が「画面表示確認」中心、「機能フロー検証」が浅い**
   - 静的 screenshot ≠ 動的 click → effect → state 反映の検証
   - Round 3a で「event カード使用フロー Playwright 含む」と session log に書いたが実際は描画確認のみ

2. **smoke test 1000 戦は AI policy 経路のみ通る**
   - `playTurn(state, HeuristicPolicy)` で engine 直回し、UI dispatch 層は素通り
   - heuristic AI が action[事件] を選ばない経路 / event カードを使わない経路は未検証
   - UI 配線バグ (BUG-006) / 自動遷移バグ (BUG-009) は smoke で検出不可能

3. **「実装と配線の分離」**
   - 各 mutator / flow function は unit test 済、しかし dispatcher 経由の end-to-end が欠如
   - 配線ミス (BUG-006/008/009) は誰も検出できない構造

4. **カード追加時の依存性チェックなし**
   - 新規 trigger.hook 使用時に listener 側の対応必要性が形式化されていない
   - 結果: 'enter' 等の hook を使う card 多数あるが listener 一切なし

5. **session log の「規約遵守記述」が形骸化**
   - 「§セルフレビュー / §水平展開 実施済」と書いても実体伴わず
   - チェックリストではなく散文記述のため検証性が低い

### 防止策 (Round 4a Phase 6 で実装)

- **6.1**: end-to-end integration test ([tests/integration/dispatch-to-state.test.ts](../../tests/integration/dispatch-to-state.test.ts)) で dispatch→state を検証
- **6.2**: カード追加チェックリスト spec 化 ([.claude/specs/card-addition-checklist.md](card-addition-checklist.md))
- **6.3**: 機能変更を含む round では Playwright 1 試合通し検証を必須化 (CLAUDE.md 追記)
- **6.4**: 全 PR で `.claude/bugs/` 更新を CLAUDE.md に明記

---

## 水平展開計画 (Round 4a Phase 2)

### A 系: dispatch case 分岐漏れ

対象: `src/ui/hooks/useEngineDispatch.ts` 全 case の apply ロジック走査
重点 case: `actionJudge` (BUG-006 の元)、`solveCase`、`actionAgainstCase`、`actionContact`

調査結果 (Round 4a): actionJudge case には `ax.target.kind === 'case'` 分岐済 (line 277-280)、`flow.actionCase.removeOpponentEvidenceTop` / `gainSelfEvidence` も呼ばれている。BUG-006 の根本原因は state-machine 上の到達性問題の可能性 → 次セッション再調査。

### B 系: 条件達成時の自動遷移漏れ

公式ルールで「条件達成時に自動遷移」のルール 6 件:

| ルール | 状態 |
|--------|------|
| FILE 7+ で事件編→解決編 (rules/01, 25) | ✅ Round 4a 修正済 (BUG-009) |
| 必要証拠数 + アクティブパートナー + 事件解決 → 勝利 (rules/01) | 既実装 (mutate.partner.solveCase) |
| リフレッシュ時にリムーブ 0 → 敗北 (rules/04) | 要確認 |
| リフレッシュ時に痕跡未発見 → 痕跡発見済み (rules/13, 26) | 要確認 |
| 現場 6 枚以上 → スイッチ強制 (rules/30) | 要確認 |
| LP 0 以下推理 → 証拠 0 (rules/11) | 要確認 |

→ 残り 4 件は次セッションで grep + 確認。

### D 系: kind 分岐漏れ

4 kind × 5 経路 マトリクス:

| 経路 \ kind | character | event | partner | case |
|-------------|-----------|-------|---------|------|
| handUseCard | ✓ | ✅ Round 4a 修正済 (BUG-008) | (使えない) | (使えない) |
| nextHint | ✓ | ✅ Round 4a 修正済 (BUG-008 水平展開) | (使えない) | (使えない) |
| scene enter (mutate) | ✓ | (キャラのみ) | (パートナーエリア) | (事件エリア) |
| カットイン | (使えない) | カットイン能力 | (使えない) | (使えない) |
| 変装 | ✓ | (使えない) | (使えない) | (使えない) |

### E 系: listener 未登録 hook (重大、Round 4b で大規模対応)

カード定義で使われる trigger.hook (調査済):

- `'enter'` — 多数 (D08003/011/013/015/019/021, D11003/005/009/014/015, _shared/souzaX)
- `'effect:declared'` — D08024, D11019, D11020, _shared/eventRemoveByAP
- `'action:declare'` — D08021, D11015
- `'action:guarded'` — D11016
- `'contact:start'` — D11007
- `'case:to-resolved'` — _shared/caseResolvedHandRemove
- `'phase:end:start'` — D08003

既存 listener 配線 (`src/engine/listeners/`):

- `hirameki.ts` — `'evidence:remove-by-action'` のみ
- `misread.ts` — `'reasoning:before-add'` のみ

**結論**: 上記 7 種類の hook すべて listener 未配線。triggered ability は全カード不発状態。
→ Round 4b で `triggered.ts` listener 新規 + 7 hook 配線。

---

## 凡例

- **重大度**: 重大 / 大 / 中 / 小
- **種別 (category)**: engine / UI / メタ (規約・運用) / 機能 / パフォーマンス
- **状況 (status)**: 未着手 / 対応中 / 検証中 / 修正済 / 保留 / 修正不要
- **担当 round**: Round 4a / 4b / 4c / 5+ / 未定
