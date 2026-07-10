# 次セッション再開プロンプト — CARD PHASE (2026-07-10 M2 後半 batch 出荷後)

> モデル方針: 本体 opus (リファクタ系のみ fable)。subagent = CLAUDE.md「モデル段階化」表 — **★model 未指定禁止 (未指定 = session モデル継承。判定表 = CLAUDE.md 2026-07-10 追記)**。⚠ 応答は日本語。Caveman + Ultracode 有効。
> 履歴詳細は CHANGELOG.md / .claude/sessions/ / memory MEMORY.md / DEFERRED-INDEX.md を参照 (本ファイルには書かない)。

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-07-10 深夜、✅M2 後半 batch 出荷 = M2 完了)
- **engine 骨格凍結済**。メイン作業 = CARD PHASE。
- **✅M2 後半 batch 出荷済 (2026-07-10 深夜、e1606037)**: engine additive 15 点 (mill/hdb dyn +
  shuffleMoved + drawUpTo bind + sceneEnter multi bind + charSetCard faceUp + bindRef +
  toHandOnTurnEnd + cutinTextIncludes + lvlDeltaInHandPer + discard chooser:'source' +
  Cost selfLpDeltaTurn/removeFromHandDownTo + on-set-host rider walk + area 配列 union +
  **resolveDynArgs walk-literalize guard** (未bind $bound 保留 — B08028 宣言経路も修復)) +
  **15 unit + PR240 + P spread 14 = +30 printings (1867→1897、残 177)**。
  T2 混成 review (sonnet5+fable): semantic BLOCK1 誤検出棄却 / edge BLOCK3 同 wave 修正
  (B05045・B08086 cutin 全角＋統一 / B07100 side:'opp' / PR234 union remove 先) /
  B09019 ban 無条件化 (字義裁定)。nits = DEFERRED-INDEX「M2 後半 batch nits」節。
  B02039 は M3 送り (T3 UI)。
- **★次 = M3: UI mega (PA batch + B09027 cost-choice + B08068 human 0公開)**。
  前処理済 dossier = [specs/grounding/m3-pa-batch.md](specs/grounding/m3-pa-batch.md) —
  「宣言19+発動5」の逐語 ID は不在、実プール = MR 25 + 既出荷 scope 補正 5 (B07079 等が
  scope:'on-scene' のまま) + 非 MR PA 宣言 8 ≈ 33 候補。M3 冒頭で npm run ground 再確定。
  UI 工事 = 新規 modal 0 / 既存流用 3 (PartnerArea.tsx / enumDeclaredAbilitySources / flows.ts) /
  配線 ~19。engine gap なし。T3 = UI 基盤 3 点 + family exemplar 1 の playwright。
- **M4/M5 grounding も前処理済** (待ち時間で完了、specs/grounding/ 永続化):
  M4 = intercept ⑦ 3 枚 BLOCKED (pick-finalization hook が真に不在、T3 新機構) +
  attribution 残 4 SMALL_GAP (B01070 selfUid / B05009+D10022 enterSource side / B03040 evidencePeek) +
  大物 A: B01020 GREEN (B04072 clone!) / B03111・B04073 SMALL_GAP / B02022 BLOCKED (新 primitive 設計要)。
  M5 = stacked-identity: B06005・B08019 SMALL_GAP (stale 2 検出) / B08003・B08074 BLOCKED +
  大物 B: B09112・B06042 SMALL_GAP / B01092・B06020 BLOCKED。
- **★残枚数 随時報告義務**: session 開始時 + 出荷ごと「出荷済 X / 2074 = 残 Y printings」を報告
  (実測 = npm run lint:icon-abilities)。出荷後は本ファイルのこの行も更新: 現在 **1897 / 2074 = 残 177**。
- vitest baseline = **5064 pass + 1 expected-fail + 1 skip** / smoke winsA=**472** exceptions=0 / 8 lint err0。
- ★開始時 `git ls-remote origin main` + `gh run list -L1`。並行 session 前提 → worktree
  (C:/tmp/megaw1 再利用可、node_modules junction 済。gen-p-spread は CONAN_ROOT=<worktree> +
  事前に npx tsx scripts/compiler/dump-shipped.ts で shipped-dsl 再生成) + 明示 pathspec add + push 先着 FF。

## 残 177 の攻略計画 (優先順、roadmap = specs/completion-roadmap-2026-07-10.md M-plan)
0. **M3 (次 session) = UI mega** — 上記 現在地の M3 節 + specs/grounding/m3-pa-batch.md 参照。
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
