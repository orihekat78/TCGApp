# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-07-04-cardphase.md](sessions/2026-07-04-cardphase.md)。
> 再開手順: Track A = `.claude/NEXT-SESSION-PROMPT.md` / Track B = `.claude/NEXT-SESSION-PROMPT-TRACK-B.md`。

## 2026-07-04 夕 CARD PHASE hybrid-pilot-1 — hybrid 穴埋め pipeline 実証 (19枚 + BUG-175)

- **歩留まり: 15 unit → 10 GREEN (67%) = 17枚 + P spread 2 = 19 printings**。refuse-1行 132枚から
  twin 10 group + 単発5 を選定。workflow (author opus ×15 / verify sonnet5 lens、chunk4 直列、
  agent 25・payload は .tmp/_hybrid_pilot/*.json 経由) → 決定論合成 (_hybrid_merge.cjs:
  compiledRest verbatim + twin 同文機械証明) → codegen 17。
- **BUG-175 修正 (engine 4 site)**: pick 解決後 event.queue source.player=chooser → cross-side pick
  (B04058 相手手札リムーブ) で二重反転。ownerPlayer 同梱 + fallback。probe 実測で発見 (log 追跡:
  awaiting-pick→effect:discard target空 → applyPickAndContinuation 手動再現で queue ctx 特定)。
- **stale DEFER 2件解消**: D02008 (wave-0629d cutinBanOpp_action が想定 consumer 名指し済) /
  B06086 (W5 evidenceFlip bind+declined=[] で count-flipped 表現可)。B03098 旧 refuted も現行経路で解消。
- **DEFER 5 unit** (全て engine gap 実在、DEFERRED-INDEX 新節): mill bind 欠落 (PR132/PR201 系、
  discard:77 と同一行形で解禁可) / remove→deck-bottom pick / charOverrideAP turn-scope / B04038 再確認。
- **pipeline 教訓**: ① verify lens は plumbing 罠を見ない → 本体 shipped-idiom 突合が必須工程
  (B01035 explicit-$pick→短縮形 / B03104 player 補強の 2 spec 修正)。② codegen 前に ability key 順
  正規化 (scope<type、lint-listener 800字 forward-scan 前提)。③ fake emit payload は production 形
  (mutate/scene.ts:323 等) を丸写し — side/removedChar 欠落で matcher 不発の偽陰性を踏んだ。
- gates: tsc0 / vitest 4172+1skip (+32 probe) / smoke 472 exc0 / 8lint0 / crosscheck 14/14。
- B03104 は BUG-176 (使用中イベント +1 計数、D11019 precedent) 起票のみ、境界 probe は解消後。

## 2026-07-09 CARD PHASE hybrid-batch2 — parked 資産 verify→ship (38枚)

- **前 session (2026-07-04 夜) が C:/tmp/megaw1 に未commit park した batch2 を再開・出荷**:
  card 23 + probe 17 は authored 済だった → 残 probe 5 (B07032/B07036/B09016/B09022/B09089) を
  opus agent ×5 並列 author (計35 test、全 production dispatch 経路 + human pick 駆動) + PR302 shape 1。
- **P spread 15枚** (.tmp/_hybrid_spread.cjs、前 session 準備済): TSV 全列同文 15/15 機械証明 →
  spread 形で個別検証スキップ (rules/02 同 ID)。batch 計 38 printings、shipped 1638→1676。
- **engine touch 1 (additive)**: buildShortFormPick に excludeSelf 露出 (candidates.ts:314 既 honor、
  consumer B01084)。validator JSON_CONT_KEYS +3 (caseActionBan/grantTraits/grantNames) で B05012 解禁。
- **DEFER 13 → DEFERRED-INDEX「hybrid-batch2 由来」節**。最大 cluster = contact-参加者 filter cond
  (B02006/B02080/PR278、新 cond contactCharMatches 1本で解禁可 = 次 engine mini-wave 候補筆頭)。
- **fix 2件**: B06098.test.ts の require('@/...') alias 実行時解決不能 → top import 化 /
  reuse-batch.test.ts abilities>0 を case のみ免除 (vanilla case PR302 初出荷)。
- gates: tsc0 / vitest 4320+1skip / smoke 472 exc0 baseline OK / 8lint err0 / crosscheck 14/14 /
  validate 23/23。⚠ check-smoke-baseline は `-N` suffix 必須 regex vs writer 初回 `-N` なし — rename 回避 (tooling nit)。
