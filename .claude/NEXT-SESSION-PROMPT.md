# 次セッション再開プロンプト (2026-06-22 — spectator-speed flake 修正済 / 次は B か C候補2/3)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㉞ — local commit 5a3a635e、push 未 / 要認可)
C 候補1「spectator-speed step テストの flake 修正」を出荷 (test のみ、engine/hook 不変)。
- 開始時に `git ls-remote origin main` で実際の取込みを確認。**㉞ commit 5a3a635e が push 済か** を必ず見る
  (前セッション終了時点で push 未認可のまま終わった可能性。handoff の取込み記述を鵜呑みにしない)。
- 先行 ㉝ B05102 wave は main 取込み済 (6fdf136d、CI green)。
詳細: memory.md ㉞。

## ㉞ サマリ (検証済: tsc0 / eslint0 / 同テスト単体 18 連続 pass(旧 fail率~30%) / full e2e 121pass 1skip 0fail / docs:check green)
- 問題: spectator-speed.spec.ts:80「pause→step→resume」が時々 fail (obs 16838/16839)。
- 旧仮説「fixed waitForTimeout(500) timing flake」は **誤り** (poll 20s でも fail で反証)。
- 真因 = **先攻 coin flip (~50%) × driver step 粒度の非対称**:
  self driver(useSpectatorTurnDriver)=playTurn で 1 ターン丸ごと → 1 step で turn 進む /
  opp driver(useOppTurnDriver)=stepTurn で 1 手ずつ(design: step=per-move) → 1 step では turn 進まず。
  先攻=opp の game で「1 step→turn 進む」を期待し fail (action log で確定)。
- 修正: 「turn が進むまで step を繰り返す」+ 各 step が 1 手前進を condition 待ち、speed=0 で連打 collapse 回避。

## ⚠ latent 非対称 (未修正・要判断、㉞ で発見)
spectator の self driver=whole-turn / opp driver=per-move。design 上 step=per-move なので self も stepTurn 化が
一貫するが、Round 4l の意図的簡略の可能性あり。BUG 化せず記録のみ。直すなら useSpectatorTurnDriver を
stepTurn + self-move-tick 化 (UI hook 変更、別タスク)。観戦で self ターンが「1 手ずつ可視化」されない UX 不一致。

## 次にやること (要ユーザー選択)
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ (engine 解凍 cluster 含む)。
   候補2: continuation-nest 修正 (BUG-111 family、B06033/B06033P 等を解禁)。中規模 engine。
   候補3: condition-gated continuous levelDelta (ContinuousModifier.levelDelta + 全 level-read site honor、
           PR264/B08059/B08050 解禁)。大規模 engine 解凍。
   候補4 (新): spectator self driver の per-move 化 (上記 latent 非対称、UI hook、小〜中)。
A) カード追加継続 = 誤 DEFER 再評価 or engine拡張 micro-cluster (1base/wave、非推奨)。残候補は DEFERRED-INDEX 参照。
→ 開始時にユーザーへ方向確認。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- バグ/flake は **systematic-debugging skill** で根因確定してから修正 (㉞ で timing 仮説を反証→coin flip×非対称を action log で確定)。仮説を反証する証拠を必ず取る。
- ★spectator driver: self=playTurn(全手/step) / opp=stepTurn(1手/step)。aiStepCounter は design 上 per-move。
- ★e2e の「fixed waitForTimeout→assert 進行」は flake 源。condition-based 待ち (expect.poll / waitForFunction) に統一 (full-match-human-vs-cpu.spec.ts が手本)。ただし真因が timing でない場合あり (㉞)。
- Read hook が file を line1 で切る → Bash cat で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint。新 src/test/spec + sessions/ rotate で structure/mapping/changelog 変わる → npm run docs 同期後 commit。auto docs の差分が source-hash のみなら正常 (日跨ぎの再生成)。
- git add は対象ファイル + 再生成 auto docs を stage、除外は .gitignore(現在 +.superpowers/ で M、コミット対象外)/.claude/design/.claude/reports(smoke含む)/.tmp-*。★`git reset $(空)` は全 index を unstage するので空引数に注意。
- ★push to main は classifier が per-session 認可を要求する場合あり。push 後 `git ls-remote origin main` で実取込みを必ず確認。
```

C 候補1 (spectator-speed flake) commit 5a3a635e → local main、push 未 (要認可)。次タスク未確定 — 開始時にユーザー確認 (B / C候補2-4 推奨、A 非推奨)。`/clear` 後の新セッション推奨。
