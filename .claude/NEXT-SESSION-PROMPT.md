# 次セッション再開プロンプト — CARD PHASE (2026-07-04 hybrid-pilot-1 出荷後)

> モデル方針: 本体 opus (リファクタ系のみ fable)。subagent = CLAUDE.md「モデル段階化」表 (grounding/意味等価 = sonnet5 high / 敵対 review = sonnet5+opus 混成、割れたら fable or 実測裁定 / 機械 = sonnet low)。⚠ 応答は日本語。Caveman + Ultracode 有効。
> 履歴詳細は CHANGELOG.md / .claude/sessions/ / memory MEMORY.md / DEFERRED-INDEX.md を参照 (本ファイルには書かない)。

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-07-04 夜、hybrid-pilot-1 出荷)
- **engine 骨格凍結済**。以後 engine は ±5/軽微 touch-up のみ (直近: BUG-175 4 site)。メイン作業 = CARD PHASE。
- 出荷済 **1638** / corpus 2074 (pilot で 19枚: 17 + P spread 2)。残実 author ≈ 276 (1行refuse 残 ~113)。
- vitest baseline = **4172 pass +1 skip** / smoke winsA=**472** exceptions=0 / 8 lint err0。
- **hybrid pipeline 実証済 (歩留まり 67%)**: pilot 15 unit → 10 GREEN=19枚 / 5 DEFER (全て engine gap 実在、
  DEFERRED-INDEX「hybrid-pilot-1 由来」節)。**BUG-175** (pick 解決後 queue ctx=chooser、cross-side 二重反転) 修正。
  教訓: ①verify lens は plumbing 罠を見ない→本体 shipped-idiom 突合必須 ②codegen 前 key 順正規化 (scope<type)
  ③fake emit は production payload 丸写し。詳細 = changelog 2026-07-04-05 / sessions/2026-07-04-cardphase.md。
- ★開始時 `git ls-remote origin main` + `gh run list -L1`。並行 session 前提 → worktree (C:/tmp/megaw1 再利用可、
  node_modules junction 済) + 明示 pathspec add + push 先着 FF。

## 残 ~276 の攻略計画 (優先順)
1. **hybrid pipeline 本番化 (35 unit/session)**: 残 1行refuse ~113 から twin group 優先で 30-35 unit。
   手順 = 前回 script 再利用 (.tmp/_hybrid_refuse1.cjs 再生成 → _hybrid_payload_gen.cjs UNITS 差替 →
   workflow author+verify → _hybrid_merge.cjs → **key 順正規化 → 本体 shipped-idiom 突合 (pick carrier/
   PA短縮形 player/BUG-130) → codegen**)。DEFER 率 ~1/3 想定、DEFERRED-INDEX 既 DEFER と照合してから選定。
2. **hybrid-pilot DEFER 解禁 mini-wave (engine、5 unit→9枚)**: mill bind capture (discard:77 同一行形) +
   removeAreaToDeckTop dest:'bottom' + charOverrideAP scope:'turn' + removeAreaAllToDeckBottom player param。
   全部 additive 小粒 — /engine-wave 1 本。解禁後 card 側は clone 同然。
3. **随伴 sweep 標準化 (毎 session 末尾)**: dump-shipped → param-mine rerun → spread (P variant) + twin harvest + crosscheck。
4. **機構 cluster**: case 8枚 (事件解決書き換え+証拠隠滅、P10/P53 出荷済) / on-set-host イベント 5枚 / 捜査観測系。
5. **PA宣言19+発動5 batch** (UI 一括: PartnerArea 描画 + enumDeclaredAbilitySources partnerMR + tile pick +
   rider description 統一。B09108 a2 PA発 human 宣言も解禁。DEFERRED-INDEX batch2 節)。
6. **残 engine DEFER**: B09112 (pre-walk dyn literal 化) / B06042 (charGrantAbility declared 3 gap) / B06020 (hand-scope aura) /
   B01092 (human-defender window) / stacked-identity 系 (B08003/B06005/B08019/B08074) / BUG-176 (event 自己計数)。DEFERRED-INDEX 各節。
- 並列 lane 可: card phase の衝突面は _reuse/index.ts (append-only) と docs のみ。パッケージ別 2-3 lane 並走可。

## 手順 (確立済、詳細は skill /card-wave・/engine-wave)
- 階層判定: T0 (clone) = crosscheck+validate+tsc、batch 末尾 full gates / T1 = +sonnet5 意味等価 lens / T2+ = 混成 review。
  playwright は T3 or 新 UI 部品型のみ (2026-07-02 tier 規約)。clone は決定表 diff (twin canonical deep-equal) で代替。
- card author 前: `git grep <ID> src/cards` 登録確認 + 全句 engine 実測 probe (第2gate) + DEFERRED-INDEX 該当節読み。
- probe は production dispatch 経路 (activateDeclaredAbility + runAllUntilEmpty、BUG-171) + **owner='opp' pin (BUG-174)**。
- pick carrier = 短縮形必須 (BUG-130) / on-hand triggered = selfOnly (BUG-032) / hand-pick kind:'character' (BUG-123) /
  「〜まで」=0可 (rules/15) / 新 verb/cond は union+map+cjs 3点同期 (sync-taskA-whitelists が検出)。
- workflow: args は使わず **payload を .tmp の JSON に書き agent に Read させる** (string化/permission reject 回避)。
  並列は chunk 4 (rate-limit 実測)。reviewer には worktree 絶対パス明示。
- 6ゲート: tsc 0 / full vitest (baseline 減なし) / smoke:1000 + check:smoke-baseline (472) / 8 lint / crosscheck / validate-specs。
- commit: 明示 pathspec + --no-verify → fetch → rebase origin/main → push origin HEAD:main → gh run list CI green。
- **smoke json/md は rm してから npm run docs** (structure.md 汚染回避)。changelog-entry 手書き → docs:changelog。
- Read hook line1 truncate → 全文は Bash cat。OneDrive stale-read は node fresh read で裏取り。

## Track B (compiler、別 lane)
- B4 param rule 出荷済。batch3 で productions.cjs description 転記 + exceptions (B09090P/P2) 修正済。
- 次: 出荷増後の re-mine (compile 可域拡大) / gen-simple-cards rerun (PR302 等 vanilla/simple) /
  closure 持ち base の parallel は spread + exceptions 処置 (DEFERRED-INDEX batch3 節)。
- Track B 詳細 driver = NEXT-SESSION-PROMPT-TRACK-B.md。
```
