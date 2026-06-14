# 次セッション再開プロンプト (2026-06-14 engine拡張 wave#2 cluster5 完了時点 / cluster6 着手用)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**
> 使う。難判断 agent (certify / 意味等価突合 / 敵対レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md「トークン運用ルール」。

> ⚠ **cluster5 の main 反映が未完**: commit `6eec0047` は branch `cards/wave2-cluster5` 上。ユーザーが手動で
> `git checkout main && git merge --ff-only cards/wave2-cluster5 && git push origin main` を実行する予定。
> 新セッション開始時に `git log -1 origin/main` で cluster5 が main に乗ったか / CI green か確認すること。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/memory.md → .claude/specs/engine-wave2-cluster5-usage-restriction-design.md を読んで状況把握。

## 現在地 (2026-06-14) — engine拡張 wave#2 (承認済 work order ③)

- cluster1〜4 ✅ (d7c4a2e9 / ec6c9780 / 3606f829 / ae934642 / 431b8eed)
- **cluster5 ✅** (commit 6eec0047, branch cards/wave2-cluster5、main push はユーザー手動・要確認):
  usage-restriction aura 3枚 (B02063/B04034/B09017)。新 field ContinuousModifier.opponentRestrict +
  reader read.char.restrictsOpponent + contact.ts canCutIn/disguise:into ガード。whitelist 3点同期は不要。
  ALL_CARDS 1158→1161。全ゲート green (vitest 2091 / smoke baseline 完全一致 / e2e 119)。

## 次にやること: cluster6 = B09034/B09034P (M3 イベント使用不可)

cluster5 と同 work order ③ の続き。usage-restriction 族の残り。**/card-wave skill を呼ぶこと。**

### 公式テキスト (緑イベント lv5、P は reprint で同文)
「自分のリムーブエリアにあるイベントを2枚まで選び、手札に加える。このターン中、自分はイベントを使用できない。
（能力や効果によっても使用できない）」/ 【ヒラメキ】リムーブのイベント1枚まで手札に加える。
qAndA: ban = カードの使用/ネクストヒントでイベント使用不可 +「イベントを使用する」効果も不可。カットイン/ヒラメキは制限外。

### engine 設計 (2部、grounding 済)
1. **M3 verb (additive)**: 新 AtomVerb `setEventUseBan` (3点同期要: effect.ts union + atom-handlers map +
   taskA-validate-specs.cjs VERBS Set、sync-taskA-whitelists.test が gate) + `TurnScopedFlags.eventUseBanned?:boolean`
   (game-state.ts:82-93、reset は mutate/flag.ts:68-71 に追加) + gate を handUseGateCommon (hand-use-card.ts:56-68、
   `d.kind==='event' && eventUseBanned` のみ) + next-hint.ts:120-125 (event 分岐) に追加。カットイン/ヒラメキは触れない。
2. **前提エンジン拡張**: B09034「2枚まで」は `forEach over:{kind:'pick'}` が **実行時 throw**
   (resolver.ts:122 が picked 無しで resolveTarget → target/resolve.ts:26 throw)。素 handAddFromRemove は value[0] 1枚のみ
   (atom-handlers.ts:579-602)。→ **handAddFromRemove に複数pick path (`$pick.cardIds`、charStackCard:atom-handlers.ts:1104-
   1159 + apply-pick.ts 同型) を additive 追加**。human+AI 両 path で 0/1/2枚取得を専用テストで実証。
   clause1→clause2 は **sequence** (chain でない → 0 pick でも ban が走る)。

### 必須プロセス
- gate 毎の設計レビュー (Workflow 調査 + 敵対設計レビュー、全 opus)。
- 新カードは非 MVP → smoke は no-op 回帰のみ。**新挙動は専用 vitest** で実証 (BUG-132 教訓):
  event-ban が 手札使用/ネクストヒントの event を阻止 / character は阻止しない / カットイン・ヒラメキは阻止しない /
  ban は turn reset で消える / B09034 2枚まで 0・1・2 取得。

## 状態 doc
- 設計記録: .claude/specs/engine-wave2-cluster5-usage-restriction-design.md (cluster6 節に M3 詳細)
- defer 一覧: .claude/specs/DEFERRED-INDEX.md / bug: .claude/bugs/index.base (BUG-143/144 未着手)
- triage: .tmp/cluster4-triage.json (usage-restriction gate 評価、B07005/D02008 は別機構で DEFER)
- 公式 Q&A 一次データ: cards-data TSV qAndA 列 (web fetch 前に必ず見る)

/card-wave を呼んでから cluster6 に着手してください。
```

cluster5 は完了 (commit 済・main push 待ち)。次は cluster6 (B09034/P) から開始してください。
