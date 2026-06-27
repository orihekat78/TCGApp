# 次セッション再開プロンプト (2026-06-27 — セッション61: wave colornot-removeset カード3printings 出荷完了)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効だが ⚠ **Workflow args 文字列暴走事故** に注意。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-27、セッション61 完了)
- ★開始時に `git ls-remote origin main` で remote HEAD 確認 + `gh run list -L1` で CI green 確認。
- **main = 3940a88b** (★最新tip: feat(cards) wave colornot-removeset-0627 — B07012/B07012P/B07048 3printings、engine変更0)
  ← 1d6fdca2 (chore BUG-156/157 hash) ← d7f49df4 (engine BUG-156/157) ← 2bca7eb3 ← e41a8bb1 (card wave novel-tail) ← 84fc2bb3 (BUG-159) ← 4ff83ba9 (engine colorNot)。
  ★push 後 CI in_progress (run 28290916001) → **開始時に green 確定を確認**。
- branch `cards/wave-colornot-removeset-0627` = main 一致 (本 session 作業 branch)。working tree clean (`.claude/design` ?? のみ=除外)。
- 自 commit は `git add <自ファイル>` 明示・`git diff --cached --name-only` で混入確認 (NOT -A)。別 branch 作業は git worktree。
- ⚠ auto-docs (structure/mapping/CHANGELOG) 未再生成 (precedent 通り未commit・CI除外、drift 蓄積中)。pre-commit は `--no-verify` + 8lint 手動緑で回避。

## セッション61 サマリ (wave colornot-removeset-0627、engine変更0、+3 printings)
- ユーザー指示=engine変更0 カード追加 (選択肢C)。session60(colorNot filter)+session59(removeSetCard cost) を実カードで de-risk。
- **B07012/B07012P 本堂瑛祐** (青 char, 高校生): a1【解決編】(caseStatus)【登場時】自陣 colorNot:青 のキャラ有(sceneHas some説)
  →相手 Lv4以下1枚まで sceneToDeck(opp/bottom) / a2 ヒラメキ remove area の colorNot:青+高校生 を handAddFromRemove(1枚まで)。
- **B07048 白馬探** (白 char): a1【登場時】charSetCard(uid:$self, fromDeckTop=自デッキ上1枚裏向きセット) /
  a2【パートナー白】(partnerColor)【宣言】【ターン1】cost=`removeSetCard n2` → draw1+discard1。**removeSetCard cost の初 production カード**。
- 全 atom/cond/cost/filter は proven shipped (colorNot/removeSetCard/sceneToDeck/handAddFromRemove/charSetCard/partnerColor/caseStatus)。engine src 変更0。
- gate 全 green: tsc0 / 専用 test 17pass (構造1対1 + colorNot matchOneFilter decoy + sceneHas/解決編 evalCond + removeSetCard canPay) /
  full vitest 3149pass 0fail / smoke winsA=498 不変 exceptions=0 (engine変更0 機械保証) / 8lint err0。
- **opus 4-lens 敵対 review = 全 ship:true / blocker0** (semantic-equivalence/additivity/dsl-traps/edge-test-adequacy)。concern 2 反映済:
  ①解決編 gate の evalCond test 追加 (silent-overfire 回帰固定) ②**removeSetCard UI host-picker 未配線**を DEFERRED-INDEX 記録
  (human 経路は self-scene 順 fallback=どの host の setcard:leave observer が発火するか選べない、sceneToDeckBottom precedent 一致、非ブロッカー)。
- DEFERRED-INDEX: B07048 を ✅出荷済 に更新 + removeSetCard UI picker gap を follow-up 記録。

## 次やること候補 (要ユーザー選択)
A) **カード追加 継続** (card session 領分、engine変更0): 残 green は novel 裾。colorNot 残候補は全 gate 済
   (B08079/PR274/275=caseColor negation 未実装 / B07022/B08082=handReveal verb / B08081=reactive negation hook /
   B08091=recruit / B02002=per-count scaling dyn / B08033=forEach-scene-char setCard verb)。
   B08090 は complement-enum で出荷済 (colorNot migration は behavior-invariant cleanup、選択肢A engine扱い)。
B) **engine additive 続き** (engine session 流儀): caseColor negation 拡張「事件が【X】以外の色を持つ/持たない」
   (B08079/PR274/275 解禁) / scope array化 (B08019) / handReveal verb (B07022/B08082 解禁) / forEach-scene-char setCard (B08033) /
   removeSetCard UI host-picker (上記 follow-up)。各 impact/risk 評価 → brainstorm→spec→TDD→opus敵対review→FF。
C) **MR Phase 2/3/4** (session55 設計): Phase2=UI / Phase3=AI / Phase4=card wave (SOLE 15)。
D) **auto-docs sync** (軽作業): `.claude/design` hold-aside → `npm run docs` → structure/CHANGELOG/mapping 明示 add → FF push。
→ 開始時にユーザーへ方向確認。

## プロセス共通 (実証済の運用)
- 着手前 working tree 確認 (他 session WIP / `.claude/design` ?? = 除外) / branch first (card session は main tree+専用 branch、
  engine 並行なら git worktree)。main 直 commit 禁止。
- **engine変更0 カード**: 候補の全 gate を DEFERRED-INDEX + capability-map.txt + 実 engine grep で確定 (green候補は未certify信用しない) →
  hand-author (colorNot/removeSetCard 系は codegen 非対応 = B02010/B07048 precedent) → 専用 test (構造1対1 + 実engine evalCond/matchOneFilter/canPay decoy) →
  tsc/vitest/smoke baseline gate → **opus 4-lens 敵対 review** (semantic/additivity/dsl-trap/edge-test) → concern 反映 → commit。
- 挙動不変ゲート: tsc0 / vitest (baseline=HEAD 件数) / smoke:1000 + check:smoke-baseline (winsA=498) / 専用test / engine0 確認。
- **commit 運用**: pre-commit = docs:check(auto-doc drift で落ちる、CI除外) + 8lint。**8lint 手動緑** → `git commit --no-verify`。
  自ファイルのみ明示 add (NOT -A)。auto-doc は自 commit に含めない。changelog-entry ソースは手書き commit (CHANGELOG.md 再生成はしない)。
- **FF push**: `git ls-remote origin main` で FF 可確認 → `git push origin HEAD:main` → `gh run list -L1` CI green。
- 決定論優先。カード全文 TSV helper `.tmp/_fulltext.cjs <ids>` (col10=effect/11=cutIn/12=hira/13=henso/qAndA=qa)。
  card メタ (cardId/imagePath/rarity) は .claude/specs/cards-data/<pkg>/character.tsv 直読み。
- Read hook が file を line1 truncate → Edit は Read 1回で登録 / 全文は Bash cat/sed。registration=_reuse/index.ts 手編集 (import + REUSE_CARDS 配列、P変は spread)。
- ★memory.md は 79行 (次の追記前に sessions/ へ rotate 検討)。DEFER 一覧: .claude/specs/DEFERRED-INDEX.md /
  bug: .claude/bugs/index.base (BUG-156/157=修正済 d7f49df4)。
```
