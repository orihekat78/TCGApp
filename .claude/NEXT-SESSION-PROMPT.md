# 次セッション再開プロンプト (2026-06-22 — 未解決 BUG-133〜136 一括解消 / 次タスク未定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊱ — branch `bugs/resolve-open-133-136`、main 未マージ・push 状態要確認)
wave#2 audit 起票の未解決 4 バグ (BUG-133/134/135/136) を systematic-debugging で一括解消。
- 開始時に `git ls-remote origin main` と `git log --oneline -3 main` で実取込みを確認。
  **branch が main に ff-merge + push 済か** を必ず見る (push は per-session 認可、未マージで終わった可能性)。
- 直前 ㉟ (continuation-nest + B06033) は main 取込み済 (f9b5d8be)。

## ㊱ サマリ (検証済: vitest 2783 pass/1 skip/0 fail / tsc0 / lint群0err / e2e 2/2 green / console error0)
branch commits: c9eeedbb (133/135) → e03bdbd5 (136 実装+134 close) → <この doc commit>。
- BUG-133 (drainAi player guard): **BUG-138 X8 で既解消**を検証。新 fix なし、bug-138-drain-ownership.test が網羅。
- BUG-135 (sequence 中間 skip-drop): **BUG-111 #2 で既解消**を検証。実カード回帰 bug-135-sequence-middle-skip.test 追加。
- BUG-134 (triggered pick 発動時確定): scan → **rules 違反の実害なし**で見送り (害B=turn-end sceneEnter 0件で実在せず /
  害A=splice 防御で rules-correct no-op)。機構を bug-134-cofire-pick-staleness.test で pin。
- BUG-136 (deckToBottomBound 順序未surface): **reorder UI 実装**。__pendingDeckReorderSide side-channel +
  pendingDeckReorder/deckReorderResolve + DeckReorderModalHost (drag+▲▼) + useOppTurnDriver 待機/再開。
  水平展開で souza (捜査X) も同配線。human 所有&2枚以上のみ surface、AI/smoke byte-equal。

## 次にやること (要ユーザー選択)
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) refactor-plan フェーズ (.claude/specs/refactor-plan/、engine 解凍 cluster 含む) / 残 bug は index.base 確認。
   候補3 (continuous levelDelta、大規模 engine 解凍) は ㉟ handoff 参照。
   候補4 (spectator self driver per-move 化、UI hook 小〜中) は ㉞ で発見の latent 非対称。
A) カード追加継続 = 誤 DEFER 再評価 or engine拡張 micro-cluster (非推奨)。DEFERRED-INDEX 参照。
→ 開始時にユーザーへ方向確認。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- バグ/制約は **systematic-debugging skill** で根因を repro で確定してから修正。仮説を反証する証拠を必ず取る
  (㊱ で「起票後に別 work で既解消」を 2 件、「rules 違反の実害なし」を 1 件、実 probe/scan で確定)。
- ★bug doc frontmatter: status=修正済 は `commit:` (hash) + `date_fixed:` 必須 (pre-commit lint:bugs)。
  解消元 commit が別なら其方を指す (133→ec6c9780/BUG-138, 135→a682b20b/BUG-111#2)。見送りは hash 不要。
- ★engine side-channel パターン: declare global + type + _drain helper (atom-handlers) + surfacePendingSideChannels +
  post-dispatch sync (useEngineDispatch) + store field/setter の 5 点 (BUG-136 __pendingDeckReorderSide が手本)。
- ★human-only engine 分岐は `__humanPlayerSide` で gate (App.tsx:73 で human play 時 set / spectator・smoke は null = byte-equal)。
- Read hook が file を line1 で切る → Bash cat / sed で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint 群。新 src/test で structure/mapping 変わる → npm run docs 同期後 commit。
  auto docs の差分が source-hash のみは正常。lint-test-pair は新 src に warn (e2e のみテストは warn 許容)。
- git add は対象ファイル + 再生成 auto docs。除外 .gitignore/.claude/design/.claude/reports(smoke)/.tmp-*。★`git reset`(空) は全 unstage 注意。
- ★push to main は classifier が per-session 認可要求あり。push 後 `git ls-remote origin main` で実取込みを必ず確認。
```

㊱ で BUG-133〜136 を全解消し branch `bugs/resolve-open-133-136` に 3 commit。main ff-merge → push 予定。
次タスク未確定 — 開始時にユーザー確認 (B / C 推奨、A 非推奨)。`/clear` 後の新セッション推奨。
