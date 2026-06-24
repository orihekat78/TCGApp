# 次セッション再開プロンプト (2026-06-24 — セッション56: orphan reg 修正 + wave decsolved-pvariants 出荷完了)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効 (実作業は Workflow オーケストレーション、token 制約なし)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-24、セッション56 完了)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = e0ef2803 (B06100/B06100P wave)、CI green**。系譜: e0ef2803 ← 3613efb1 (orphan reg 修正) ← 5352c470 (MR QA #5)。
- working tree: `.claude/design/` ?? のみ (除外対象、commit しない)。branch `cards/wave-decsolved-pvariants` = main に一致。
- ⚠ 共有 working tree ハザード継続: 別 branch 作業は git worktree 必須 (session55 で clobber 事故)。

## セッション56 サマリ
- ① **orphan reg 修正** (3613efb1): c6e31c27 (decklook 越水/ラム 4枚) が card file 出荷も _reuse 登録漏れ=死蔵 → 登録 +6行を main へ FF push。
- ② **wave decsolved-pvariants** (e0ef2803): 消失「12-15枚 wave」を full-text 再棚卸 → 真の新規 **B06100/B06100P (ベルモット) のみ**。
  10枚 (B01099P-B01102P/D07017/PR023/D09023/D09009/PR177/PR241) は既出荷 (catalog-reuse batch、敵対verify bonus QA で全 faithful)。
  白馬探 trio (B04038/PR027/PR031) DEFER。gate 全 green (validate-specs engine変更0 / vitest 3000 / smoke winsA=498)。

## 次にやること候補 (要ユーザー選択)
A) **auto-docs sync**: 新カード分 structure.md/mapping 未再生成 (precedent 通り未commit、CI除外)。`.claude/design` を hold-aside →
   `npm run docs` → structure.md/CHANGELOG/mapping を明示 add → commit → FF push。doc staleness 解消の軽作業。
B) **BUG-155 完全横展開 sweep**: PR241/PR235 の discard filter kind:character 欠落 (latent MAJOR)。全 pick系 atom (discard/sceneRemove/
   sceneToHand/handAddFromX) の filter を **parser ベース**で棚卸 (grep は複数行 filter 取りこぼし)。テキストが種別明示∧kind欠落=同型。Workflow 推奨。
C) **MR Phase 2/3/4** (session55 から継続): Phase2=UI (PartnerArea PA-MR render+選択)、Phase3=AI (move-enumerator PA-MR 列挙)、
   Phase4=card wave (SOLE 15、B06066 read/mutate 非対称 再判定)。BUG-154 #4 (MR②×switch) は実カード遭遇時に公式Q&A 照会。
D) **カード追加 継続** (engine変更0): taskA pipeline で green候補刈り取り (card-wave skill)。残実数は inventory-remaining.cjs で再棚卸。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (今session で実証済の運用)
- 着手前 working tree 確認 (`.claude/design/` ?? = 除外) / branch first。main 直 commit 禁止。
- 挙動不変ゲート: validate-specs (engine変更0) / tsc0 (`npm run typecheck`) / vitest (baseline 3000、1skip) /
  smoke:1000 + check:smoke-baseline (winsA=498) / 敵対 faithfulness verify (Workflow、opus、reps + filter-lens)。
- **commit 運用**: pre-commit hook = `docs:check && 8 lints`。docs:check は 72-file drift で落ちる (CI除外) → **8 lints を手動で緑確認 → `git commit --no-verify`** (docs:check のみ skip、real gate は skip しない)。
- **FF push**: `git rebase <main-sha>` で main 上に積む → `git push origin HEAD:main` (branch 切替なし、shared-workdir 安全)。
- カード追加: card-wave skill。taskA = validate-specs → codegen --write → register。⚠ **codegen は case kind の caseLevel を difficultyFirst から取れない** (level 列不在、未修正) → case カードは要手書き or codegen patch。
- 既出荷チェック必須: 候補が既に file 存在∧REUSE_CARDS 登録済か `find`+`grep` で確認 (再実装/重複防止)。PR系は `{...PRxxx}` spread 再利用あり。
- Bash heredoc `<<'EOF'` 使用 (PowerShell `@'...'@` は message 破壊)。Read hook が file を line1 truncate → Bash cat/sed で読む。
- カード全文 TSV helper: `.tmp/_fulltext.cjs <ids>` / col10=effect col11=cutIn col12=hirameki col13=henso col16=qAndA。case TSV は difficultyFirst/Second 列。
- ★Markdown 基本 100 行 / memory.md 80 行で sessions/ へ rotate (現 memory.md は ~70 行、次 session で rotate 検討)。
- DEFER 一覧: .claude/specs/DEFERRED-INDEX.md (白馬探 trio 追記済) / bug: .claude/bugs/index.base (BUG-155 追加)。
```
