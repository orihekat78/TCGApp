# 作業ログ — 名探偵コナンプロジェクト

## セッション㊲ (2026-06-22) — refactor Phase 3a: atom-handlers.ts 分割

branch `refactor/phase-3a`。挙動完全不変リファクタ (骨格凍結の「動作不変な内部最適化」例外)。

### 開始時確認
- ㊱ (BUG-133〜136) は main 取込み済 (remote=local=`9728c967`)。残 bug = 真の open 0 / 見送り1(BUG-134) /
  partial 3 (083 latent該当0・105 D11014継続・108 AI fan-out DEFERRED)。カード DEFER は engine-gate 由来で多数 (DEFERRED-INDEX)。
- ユーザー選択: refactor → Phase 3a (推奨)。

### 実装
`src/engine/effect/atom-handlers.ts` 1828 行 (単一 runAtom switch・55 verb) を **決定論 codemod** (c:/tmp/phase3a-split.mjs、
string/comment/template-aware lexer) で extract-and-dispatch 分割:
- barrel `atom-handlers.ts` (225 行): runAtom (preamble + dispatch switch) + 外部 API 再export
- `atom-handlers/_shared.ts` (296): 8 helper + Player + Pending*Side 2型 + _drain*2 + declare global 2
- `atom-handlers/{core(454),scene(366),char(297),picks(311),misc(119)}.ts`: case body **無改変**移送
- 計画 4→5 補正 (misc 分離、各 <500)。verb 参照 17 handler のみ `verb: AtomVerb` param。`a` 非参照 4 handler は `_a`。
- inline 3 (charSetAP/charSetLP throw, noop) は barrel 据置。

### レビュー (高リスク Phase 3 = フルパネル)
- **着手前** Workflow opus 4 lens (507k tok): BLOCKER `log` verb 脱漏 (exhaustiveness `never` compile 不能) +
  MAJOR per-file import 分配 を着手前に解消。behavior-invariance 5 罠 clear 確認。
- **実装後** opus 1 agent (111k tok): dispatch配線/re-export/preamble/exhaustiveness/未テストverb 5観点 APPROVE (0 指摘)。

### 検証 (全 GREEN)
- **byte-identity 52/52** (抽出 body の md5 が元 case body と EOL 正規化後一致、独立 verify script)。
- preamble は HEAD と byte 一致 (diff 空)。55-case ↔ 55-AtomVerb 完全 bijection。
- tsc **0** / full vitest **2783 pass / 1 skip / 0 fail** (着手前 baseline 完全一致) /
  smoke:1000 **baseline 一致** (winsA=498 exact, avg 10.998, timeouts 0, exceptions 0) /
  e2e 3 spec **26 pass** / eslint 問題数 HEAD と完全一致 (**delta 0**) / 規約 lint 8 本 errors 0。

### 学び (恒久)
- 大規模 byte-exact 分割は **決定論 codemod + per-body md5 自己検証** が王道 (エージェント手作業より安全・速い)。
- autocrlf: working tree=CRLF / git store=LF。byte 比較は **EOL 正規化必須** (skill 罠表通り)。
- tsc `noUnusedLocals/noUnusedParameters` が import/param の過不足を即検知 → codemod の auto-import + `_`prefix と相性良い。
- smoke:1000 winsA exact 一致 = 挙動不変の最強証拠 (1000 戦の AI 経路決定論)。

### commit / 次
branch commits: <codemod 分割 commit>。main ff-merge → push 予定 (push 後 `git ls-remote origin main` 確認)。
次タスク未確定 — Phase 3b (pick-resolution 再設計、3系で最高リスク) / 3c / 3d / 4 / デザイン刷新。
