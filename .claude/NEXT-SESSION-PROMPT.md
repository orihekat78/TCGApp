# 次セッション再開プロンプト (2026-06-21 — turn-scope levelDelta wave 出荷済 / 次は B/C 強推奨)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-21、セッション㉝ — commit 3d9b3090、CI 要確認)
turn-scope levelDelta wave「B05102 小五郎の弟子」(engine変更0、誤 DEFER 是正) を出荷。
- 開始時に `gh run list -L1` で CI green 確認。**git ls-remote origin main で実際の取込みも確認** (㉛で
  handoff が「取込み済」と書いていたのに未 push だった前例あり。handoff の取込み記述を鵜呑みにしない)。
詳細: memory.md ㉝ / .claude/changelog-entries/2026-06-21-06-*.md / DEFERRED-INDEX「turn-scope levelDelta wave」。

## wave サマリ (検証済: tsc0 / vitest 2759pass1skip0fail / decoy 12pass / smoke exc=0・baseline不変(avg10.998/winsA498) /
   playwright 120pass1skip1fail→spectator-speed:79 単体再走3/3pass(既知flake) / validate-specs PR280 fail=pre-existing)
engine 変更 = **なし (engine変更0)**。誤 DEFER の是正: DEFERRED-INDEX が B05102 を「continuous (temp) levelDelta
不在」で DEFER していたが、「ターン終了までレベル-1」= turn-scope one-shot = 既存 charModifyLevel{scope:'turn'}
(lvlMod_turn、turn end delete=BUG-119) で実装可能。condition-gated continuous levelDelta (B08050「【解決編】+3」=
真の engine gap) とは別物だった。
出荷 (ALL_CARDS 1371→1372): B05102 (黄L1 event、P変種なし、cardId 0600)。a1 = event-use +【パートナー黄】gate +
sequence[charModifyLevel{opp,turn,-1}, draw(必須), sceneEnter{hand,黄,levelMax:{dyn:$self.fileCount}}] (BUG-111#2 で
sequence-mandatory-tail 解禁済 → 相手0/decline でも draw 発火)。a2 = ヒラメキ self→hand (前 wave fromSelf)。

## ⚠ 重要 — A (カード追加) は依然 1base/wave だが「誤 DEFER の engine変更0 カード」が残存しうる
㉛ handoff は「engine変更0 完全枯渇」と断言したが ㉝ で **反例 B05102** を発見 (turn-scope vs continuous の
混同による誤 DEFER)。**新 yield lens**: 過去 DEFER 理由が「現 engine で今も成立するか」を再評価する
(特に BUG-111#2=sequence-mandatory-tail 等、後から解禁された機構)。ただし手間に対し yield は依然 1base 級で
**B/C のほうが ROI 圧倒的に高い (強く推奨)**。
残 A 候補 (各々別 engine 変更、DEFERRED-INDEX 参照):
  - B09078: dual-filter deck-look (1キャラ+1イベント from 1 reveal) + reveal-to-remove (engine)
  - PR096: 【宣言】cost-mill-result 参照 conditional (engine)
  - B06033/B06033P: continuation-nest (BUG-111 family)
  - B02013/B05041: set-event host-continuous (engine)
  - B03088: multi-atom-single-pick carrier 検証
  - PR264/B08059/B08050: condition-gated continuous levelDelta (真の engine gap、ContinuousModifier.levelDelta 追加)

## 次にやること (要ユーザー選択)
A) カード追加継続 = 誤 DEFER 再評価 or engine拡張 micro-cluster (1base/wave、非推奨)。
B) デザイン刷新 (memory: project-design-redesign-2026-06-19、再開=.claude/design/RESUME.md、frontend-design skill)。
C) bug 対応 (.claude/bugs/index.base) / refactor-plan フェーズ (engine 解凍 cluster 含む)。
   候補1: spectator-speed.spec.ts:79 timing flake 安定化 (実利ある小 C、日により失敗。step→turn 進行の waitForTimeout 競合)。
   候補2: continuation-nest 修正 (BUG-111 family、B06033 等を解禁)。
   候補3: condition-gated continuous levelDelta (ContinuousModifier.levelDelta + 全 level-read site honor、PR264/B08059/B08050 解禁)。
→ 開始時にユーザーへ方向確認。A 選択時は「1base/wave・誤 DEFER 再評価で稀に engine変更0 が出る程度」を明示。

## プロセス必須
- 骨格凍結: engine 変更は bug 修正 or 公式ルール変更 or engine拡張 cluster (明示判断) のみ。通常は AI/UI/カード層。TDD・1 task=1 commit=セッション境界。
- カード追加は **着手前に決定論 yield scan + 全句 grounding + main effect の実 engine 実装可否** を洗う。DEFER note は hint であって保証でない (㉝ で逆方向の誤 DEFER を発見)。
- ★turn-scope levelDelta = charModifyLevel{scope:'turn'} (既存)。condition-gated continuous levelDelta (毎read再評価) = engine 不在。混同しない。
- ★sequence-mandatory-tail: BUG-111#2 (2026-06-16) で sequence-origin の 0-pick decline/候補不在でも remainder 実行。chain-origin は drop (gate)。decoy は両端 (候補在/不在) を踏む。
- ★AI null-pick: chooseAtomTarget に case 無い verb (charModifyLevel 等) でも chooseAiPick は候補在なら cands[0] fallback。真の null は候補不在のみ。
- ★pick 駆動 test harness: charModifyLevel/sceneEnter の pick は resolveEffectPicks 前処理 (chooseAtomTarget=AI) → runEffect → drain。hirameki(handAddFromRemove) は runtime self-enqueue。混在 effect は cluster12 の runEventA1 型 (runEffect 直 + drain loop) で両方流れる。
- ★event の【パートナー色】/【事件色】/使用ゲートは ability.condition (B04064 exemplar)。event 効果は effect:declared+event-use matcher (closure 不要、D05014/B04064)。
- Read hook が file を line1 で切る → Bash cat で読む。Write/Edit は Read 1回で登録後に使える。
- pre-commit = docs:check + 規約 lint。新 src/test/spec + sessions/ rotate で structure/mapping/changelog 変わる → npm run docs 同期後 commit。
- git add は wave ファイル + 再生成 auto docs を stage、除外は .gitignore/.claude/design/.claude/reports(smoke含む)/.tmp-*。★`git reset $(空)` は全 index を unstage するので空引数に注意。
- ★push to main は classifier が per-session 認可を要求する場合あり (handoff の「許可済」だけでは通らない)。push 後 `git ls-remote origin main` で実取込みを必ず確認 (㉛ は push 未完のまま handoff が「取込み済」と誤記)。
- カード wave: **certify/敵対verify GREEN でも codegen 前に shipped exemplar と全句突合必須**。decoy で filter/gate を実 engine 経路で1対1検証 (非MVP は decoy unit test が唯一の engine 駆動証跡。境界 case 必須=不在/0枚)。
```

turn-scope levelDelta wave (B05102, engine変更0) commit 3d9b3090 → main 取込み予定。次タスク未確定 — 開始時にユーザー確認 (A=1base/wave 非推奨、B/C 推奨)。`/clear` 後の新セッション推奨。
