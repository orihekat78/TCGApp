# 次セッション再開プロンプト — CARD PHASE (2026-07-09 defer-unlock mini-wave 出荷後)

> モデル方針: 本体 opus (リファクタ系のみ fable)。subagent = CLAUDE.md「モデル段階化」表 (grounding/意味等価 = sonnet5 high / 敵対 review = sonnet5+opus 混成、割れたら fable or 実測裁定 / 機械 = sonnet low)。⚠ 応答は日本語。Caveman + Ultracode 有効。
> 履歴詳細は CHANGELOG.md / .claude/sessions/ / memory MEMORY.md / DEFERRED-INDEX.md を参照 (本ファイルには書かない)。

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-07-09 夜、defer-unlock mini-wave 出荷)
- **engine 骨格凍結済**。以後 engine は ±5/軽微 touch-up のみ。メイン作業 = CARD PHASE。
- **defer-unlock mini-wave 出荷済** (2026-07-09 夜): additive 8 primitive (contactCharMatches /
  mill bind / removeAreaToDeckTop dest:'bottom' / charOverrideAP scope:'turn' / removeAreaAllToDeckBottom
  player / phase:main:start hook / Cost partnerAreaRemove / $self.partnerAreaTraitCount) + **16 printings**
  (B02006/B02080/B02076+PR133/B04038+PR027/31/B05072/B07039/B07046/PR132+PR213/285/PR201+PR207/PR278)
  + **★BUG-177** (「〜のキャラに【カットイン】した場合」= 自コンタクトキャラ (B02006/B07050 公式QA) —
  shipped contactTargetMatches 全消費者 13 printings が逆方向だった。helper 書換で一括修正)。
  混成 2-lens review SHIP・BUG-177 両 lens CORRECT。nits = DEFERRED-INDEX「defer-unlock mini-wave nits」節。
  残 pilot/batch2 DEFER = B05022 (multi-pick carrier) + 大物 7 (B03110/B03111/B04073/B07049/B07061/D06013/PR284)。
- 出荷済 **1742** / corpus 2074 = **残り未実装 332 printings**。**★hybrid pipeline 完了 (2026-07-10 朝、refuse 1-4行 全層枯渇)** — 残 = DEFER cluster のみ。次 = **engine mini-wave** (優先 cluster 8 種 = DEFERRED-INDEX batch6 節末尾: ①turn-scope LP override ②bound levelSum dyn ③deck-reveal 拡張 ④next-hint 判別 ⑤選ばれたとき無効 intercept ⑥hand 内 continuous ⑦set-card 操作 ⑧cost choice UI) → 解禁 unit を hybrid pipeline 再走で刈り取り。
- **★残枚数 随時報告義務 (2026-07-09 ユーザー指示)**: session 開始時 + batch/wave 出荷ごとに
  「出荷済 X / corpus 2074 = 残 Y printings (残 unit ≈ Z)」をユーザー向け報告に必ず含める。
  実測 = shipped: `npm run lint:icon-abilities` (shipped=N 表示) / unit 内訳: `npm run hybrid:prepare` summary。
  出荷後は本ファイルのこの行も更新する。
- vitest baseline = **4565 pass +1 skip** / smoke winsA=**472** exceptions=0 / 8 lint err0。
- **batch3 実測 (2026-07-10 夜間自走)**: 40 unit → 13 printings (yield 30%、pool 尾の硬化)。DEFER 26+2 = DEFERRED-INDEX「hybrid-batch3 由来」節 (mini-wave 候補 cluster 5 件抽出済)。次 batch は yield 低下前提で --n 40 継続 or mini-wave (turn-scope LP override + bound levelSum dyn が最頻)。
- **hybrid pipeline 2連続実証 (歩留まり 62-67%)**: batch2 = 37 unit → 23 GREEN / 13 DEFER
  (DEFERRED-INDEX「hybrid-batch2 由来」節。★最大 cluster = contactCharMatches cond 1本で
  B02006/B02080/PR278 解禁)。P spread = TSV 全列同文 機械証明→個別検証スキップ (rules/02 同ID)。
  batch2 教訓: ①probe 内 require('@/...') は runtime 解決不能→top import ②vanilla case は
  reuse-batch abilities>0 を kind:'case' 免除 ③check-smoke-baseline は `-N` suffix filename 必須
  (writer 初回は `-N` なし、rename 回避。nits = DEFERRED-INDEX batch2 節末尾)。
  pilot 教訓 (継続有効): verify lens は plumbing 罠を見ない→shipped-idiom 突合 / key 順 scope<type /
  fake emit は production payload 丸写し。詳細 = changelog 2026-07-09-01 / sessions/2026-07-04-cardphase.md。
- ★開始時 `git ls-remote origin main` + `gh run list -L1`。並行 session 前提 → worktree (C:/tmp/megaw1 再利用可、
  node_modules junction 済) + 明示 pathspec add + push 先着 FF。

## 残 ~224 の攻略計画 (優先順)
0. ~~DEFER 解禁 engine mini-wave~~ → ✅ **2026-07-09 夜 出荷済** (additive 8本 + 11 unit 実装まで完了)。
   **次 session 推奨 = hybrid-batch3** (`npm run hybrid:prepare -- --n 40 --max-refusals 2`)。
   残 engine DEFER は大物のみ (下記 6 + B05022 carrier) — 個別 T2/T3 で都度判断。
1. **hybrid pipeline 継続 (40+ unit/session、★2026-07-09 ツール化+2行対応済)**: pool = 1行 **93** +
   2行 **125** = **218 unit (未出荷 base 248 の 88%)**。手順 = **`npm run hybrid:prepare -- --n 40
   --max-refusals 2`** (fresh 化+twin 自動 group (集合キー)+DEFER 照合+payload 一括。1行優先選定) →
   workflow author+verify (payload = .tmp/_hybrid_run/payloads/、正準 refusedLines[]。
   結果 → .tmp/_hybrid_run/wf_results.json) → **`npm run hybrid:finish`** (merge+twin 集合証明+key順
   +idiom lint+validate+codegen+register+tsc+crosscheck 一気通貫、hard violation で中断) →
   **`npm run gen:probes -- --specs .tmp/_hybrid_run/specs.json --ids <GREEN分> --out tests/cards/<batch>/`**
   (declared/enter/event-use は probe 自動生成、MANUAL 報告分のみ手書き) → 意味等価 lens → full gates。
   2行 unit は novel 2 行/unit = author 負荷 2 倍だが twin 展開が効く (D06003+3 実証)。
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
