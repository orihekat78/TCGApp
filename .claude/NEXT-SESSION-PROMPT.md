# 次セッション再開プロンプト (2026-06-23 — セッション55: MR partner-area Phase1 engine core 実装完了 / 次=push+PR or Phase2/3/4)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効 (実作業は Workflow オーケストレーション、token 制約なし)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション55 — MR partner-area Phase1 engine core)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **branch `engine/mr-partner-area-core` = eb8f6782 (MR Phase1 core)、未push**。local main = remote `ca01920b` (一致)。
  eb8f6782 は ca01920b の上に linear 積層。**push は要ユーザー承認** (前 session で承認待ちのまま終了)。
- ⚠ 前 session の失敗 (再発防止): (1) Bash tool では **bash heredoc `<<'EOF'`** を使う (PowerShell `@'...'@` は message を壊す)。
  (2) commit 前に `git branch --show-current` で **feature branch 上か必ず確認** (main 直 commit 禁止。前回 main に commit→branch へ移送で復旧)。

## セッション55 サマリ (MR partner-area Phase1 engine core)
- ユーザー選択 A「MR partner-area 実装 Phase1」。spec 2本全読み→TDD (RED-GREEN)→opus 4-lens 敵対review→fold-in→commit。
- **実装** (additive、touched src/engine 10 file): 新 slot `PlayerState.partnerAreaMR` (partner singleton 非破壊)。
  MR①=全 leave verb redirect (相手ターン gate / leave hook→redirect 順 / dest cardId 除去=refresh 単一計上 / set は rules16 で remove)。
  MR②=applyMrEntryRemoval (enter/switchEnter 冒頭、cause:effect+noMrRedirect、switchEnter self-correct で over-removal 防止)。
  PA-MR reader spine: read.scene.byUid sentinel / collectCardsInPlay / read.char continuous±scope gate / flag【ターン①】/ auto活性 / canDeclaredAbility PA scope gate。
  isMR=rarity.startsWith('MR')。dead stub 2本削除。
- **回帰**: 非MR byte-identical (smoke winsA=498)。⚠ 既登録 MR 5枚 (B05066/B07079/B07093/B08032/B09054 +P) は **MR①②有効化** (意図的、rules/18)。
- **検証 全green**: tsc0 / vitest 2969→2999 (+30 decoy、1skip) / smoke winsA=498 baselineOK / e2e 123+1skip / eslint 0err。
- **敵対review = REVISE (BLOCK 無、rules lens=SHIP)**。fold-in 済 (MAJOR-1 claim 訂正 / MAJOR-2 hook∧PA test / MINOR×4 + PA scope gate)。
- **BUG-154**: 暫定保守解5件 (要公式Q&A) + read/mutate 非対称 (B06066)。記録=changelog-entries/2026-06-23-11。

## 次にやること (要ユーザー選択)
A) **push + PR** (eb8f6782 を origin へ → PR → CI green 確認 → main merge)。Phase1 を確定させてから次フェーズ。
B) **MR Phase 2 = UI**: PartnerArea/usePartner/Playmat に PA-MR render+選択 path 追加。'mr-removed' dead union 除去 (NIT)。
C) **MR Phase 3 = AI**: move-enumerator.ts に PA-MR 宣言能力列挙。
D) **MR Phase 4 = card wave (SOLE 15)**: per-card full-text grounding→敵対verify→出荷。着手時 B06066 の SOLE/MULTI 再判定
   (scope on-partner-area + self-mutate cost なら read/mutate 非対称 gate=MULTI)。
E) **公式 Q&A 照会** (BUG-154 暫定5件の裁定): deep-research/firecrawl で commmune talk002。
F) **カード追加 継続** (engine変更0) or 他 engine 投資。
→ 開始時にユーザーへ方向確認。

## プロセス共通
- 着手前 working tree 確認 (`.claude/design/` ?? = OK 除外) / branch first。main 直 commit 禁止 (前回違反、要注意)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2999、1skip) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`、~5min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。engine 触る wave は git diff src/engine 精査。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後。subagent も Bash 指示。
  カード全文 TSV (0-index): character col10=effect col11=cutIn col12=hirameki col13=henso col16=qAndA / B0N→ct-p0N、PR→pr-01。col7=rarity(MR/MRP/MRCP)。
  ★helper: .tmp/_fulltext.cjs <ids> / .tmp/_grep-remaining.cjs <regex> / .tmp/_meta2.cjs <ids> / scripts/inventory-remaining.cjs。
- 新 .md/src → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。git add -A 禁止。.claude/design 除外。
- ★Markdown 基本 100 行 / memory.md 80 行で sessions/ へ rotate (現 memory.md は session54+55 で ~55行)。
- 重い opus workflow は1つずつ (SUB≤5〜8、server rate-limit)。敵対review/grounding/scout は同時不可。
- MR 実装の設計・暫定解・残課題: .claude/specs/engine-mr-partner-area-{design,cohort}.md + .claude/bugs/BUG-154.md。
```
