# 次セッション再開プロンプト — CARD PHASE (2026-07-04 batch3 後に刈り込み再構成)

> モデル方針: 本体 opus (リファクタ系のみ fable)。subagent = CLAUDE.md「モデル段階化」表 (grounding/意味等価 = sonnet5 high / 敵対 review = sonnet5+opus 混成、割れたら fable or 実測裁定 / 機械 = sonnet low)。⚠ 応答は日本語。Caveman + Ultracode 有効。
> 履歴詳細は CHANGELOG.md / .claude/sessions/ / memory MEMORY.md / DEFERRED-INDEX.md を参照 (本ファイルには書かない)。

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-07-04 夕、origin/main = be28a432、CI green)
- **engine 骨格凍結済 (mega-wave 全 step 完了)**。以後 engine は ±5/軽微 touch-up のみ。メイン作業 = CARD PHASE。
- 出荷済 1592 / corpus 2074。**残 482 = P-variant 165+11 (spread で自動) + 同文 twin 13 (compile+diff で自動) + 実 author 293**。
- vitest baseline = **4140 pass +1 skip** / smoke winsA=**472** exceptions=0 / 8 lint err0。
- 直近 batch3: B06085 (evidenceGain faceUp) + compiler harvest 21枚 + **BUG-174** (PA短縮形 side 二重相対化 9 site 修正 —
  教訓: 新 pick 経路は owner='opp' probe 必須)。詳細 = changelog 2026-07-04-04 / BUG-174.md。
- ★開始時 `git ls-remote origin main` + `gh run list -L1`。並行 session 前提 → worktree (C:/tmp/megaw1 再利用可、
  node_modules junction 済) + 明示 pathspec add + push 先着 FF。

## 残 293 の攻略計画 (2026-07-04 分析、優先順)
実測: **1行だけ未知 = 133枚 (全行自己完結を機械証明済) / 2行 = 127 / 3行+ = 31 / compile可 = 15-20**。
未知行 template は 417種/291枚 = per-card 固有 → compiler rule 追加での一括は不成立。軸は「行数×機構」。
1. **hybrid 穴埋め pipeline (最優先実証)**: compileCard の refuse 1 行だけ agent が DSL 化 → 残りは compiler 出力と合成。
   pilot 15枚 (1行組・自己完結) で歩留まり実測 → 良ければ 35枚/session 化。lens は novel 句のみ。probe は table-driven
   (parametrized test に [cardId, 盤面, 期待] 行を足す形式) を導入して面積削減。
2. **随伴 sweep 標準化 (毎 session 末尾)**: dump-shipped → param-mine rerun → spread (P variant) + twin harvest + crosscheck。
   決定論のみ = リスクゼロ。将来は cron 化 (PR 経由、direct push 禁止) も可。
3. **機構 cluster**: case 8枚 (事件解決書き換え+証拠隠滅、P10/P53 出荷済) / on-set-host イベント 5枚 / 捜査観測系。
4. **PA宣言19+発動5 batch** (UI 一括: PartnerArea 描画 + enumDeclaredAbilitySources partnerMR + tile pick +
   rider description 統一。B09108 a2 PA発 human 宣言も解禁。DEFERRED-INDEX batch2 節)。
5. **残 engine DEFER**: B09112 (pre-walk dyn literal 化) / B06042 (charGrantAbility declared 3 gap) / B06020 (hand-scope aura) /
   B01092 (human-defender window) / stacked-identity 系 (B08003/B06005/B08019/B08074)。DEFERRED-INDEX 各節。
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
