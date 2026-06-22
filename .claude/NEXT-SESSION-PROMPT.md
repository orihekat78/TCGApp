# 次セッション再開プロンプト (2026-06-22 — continuation-nest 出荷 / 次は B か C候補3/4)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㉟ — local commit <この feature commit>、push 状態は要確認)
C 候補2「continuation-nest engine 修正 + B06033/B06033P 解禁」を出荷 (engine 変更あり = 骨格解凍、ユーザー明示の engine拡張 cluster)。
- 開始時に `git ls-remote origin main` で実取込みを確認。**㉟ commit が push 済か** を必ず見る
  (push は per-session 認可。前セッション終了時に push 未認可で終わった可能性。handoff の取込み記述を鵜呑みにしない)。
- 先行 ㉞ spectator-speed flake fix は main 取込み済 (aeb1bf4d)。
詳細: memory.md ㉟。

## ㉟ サマリ (検証済: repro 2/2 / B06033 decoy 9/9 / vitest 2770pass 1skip 0fail / tsc0 / eslint0err / smoke winsA=498 baseline一致 / e2e pick系7/7 + full-match 3/3 console error0)
- BUG-111 #3 (continuation-nest): `sequence[chain[pausing-pick, step2], step3]` で chain (内側) が pick.continuation を
  同梱した直後、親 sequence (外側) が同 slot を上書き → 内側 step2 (handToEvidence) 脱落。continuation が単一 slot=nest 不可。
- 修正: continuation を recursive `ContinuationFrame`(`+outer?`) の linked list 化。resolver attachContinuation は
  上書きせず outer 末尾に append。apply-pick runContinuationChain が head(内側)→outer(外側) 順実行 + 再pause引継ぎ。
  decline は chain head なら remainder gate しつつ outer 実行 (B06033 swap 辞退でも sceneEnter 走る)。単一 frame は byte 互換。
- B06033/B06033P「わが味方となるべし!!」(緑L6 event) 出荷 (ALL_CARDS 1372→1374)。
  a1=sequence[chain[evidenceToHand,handToEvidence], sceneEnter{緑YAIBA lv≤6}] / a2=ヒラメキ handAddFromRemove fromSelf。

## 次にやること (要ユーザー選択)
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ (engine 解凍 cluster 含む)。
   候補3: condition-gated continuous levelDelta (ContinuousModifier.levelDelta + 全 level-read site honor、
           PR264/B08059/B08050 解禁)。大規模 engine 解凍。真の continuous (毎 read 再評価) gap。
   候補4: spectator self driver の per-move 化 (㉞ で発見の latent 非対称 self=whole-turn/opp=per-move、UI hook、小〜中)。
A) カード追加継続 = 誤 DEFER 再評価 or engine拡張 micro-cluster (1base/wave、非推奨)。残候補は DEFERRED-INDEX 参照。
   ※㉟ で continuation-nest は解消済。DEFERRED-INDEX「continuation-nest」行は✅出荷で消し込み済。
→ 開始時にユーザーへ方向確認。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- バグ/制約は **systematic-debugging skill** で根因を repro で確定してから修正 (㉟ で nest 上書きを RED test で実証→linked list 化)。仮説を反証する証拠を必ず取る。
- ★engine continuation: pick は sequence/chain に **多重に囲まれうる**。continuation は単一 slot でなく `ContinuationFrame.outer` の
  linked list。head=内側 (先実行) → outer=外側。新たに継続を付ける処理は **上書きでなく outer 末尾 append** (resolver attachContinuation)。
- ★非MVP カードは実機 deck-builder 不可 → engine decoy test (実 engine 駆動 + filter/順序 decoy) が §7 文言突合を担保。
- Read hook が file を line1 で切る → Bash cat で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint。新 src/test + sessions/ rotate で structure/mapping/changelog 変わる → npm run docs 同期後 commit。auto docs の差分が source-hash のみなら正常。
- git add は対象ファイル + 再生成 auto docs を stage、除外は .gitignore(現在 +.superpowers/ で M、コミット対象外)/.claude/design/.claude/reports(smoke含む)/.tmp-*。★`git reset`(空引数) は全 index を unstage するので注意。
- ★push to main は classifier が per-session 認可を要求する場合あり。push 後 `git ls-remote origin main` で実取込みを必ず確認。
```

C 候補2 (continuation-nest + B06033/B06033P) を branch `cards/continuation-nest-b06033` に commit → main ff-merge → push 予定。次タスク未確定 — 開始時にユーザー確認 (B / C候補3-4 推奨、A 非推奨)。`/clear` 後の新セッション推奨。
