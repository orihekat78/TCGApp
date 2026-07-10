# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-07-10.md](sessions/2026-07-10.md) (夜間自走 batch3-5、repo public 化 B 案、BUG-178)。
> 再開手順: Track A = `.claude/NEXT-SESSION-PROMPT.md` / Track B = `.claude/NEXT-SESSION-PROMPT-TRACK-B.md`。

## 2026-07-10 (rotate 後)
- 夜間自走: batch3 (13) + batch4 (18) + batch5 (7) = +38 printings、1730/2074。詳細 = sessions/2026-07-10.md。
- batch6 (3-4行 最終掃き): 11 unit → 6 printings (1730→1736)。**hybrid pipeline 完了 = refuse 全層枯渇**。
  tooling: grantKeywords 配列→closure codegen 変換 / whitelist +2 / prepare moreLine 拡張 / BUG-130 lint
  orphan-参照化。B09067 は lens が BUG-161 hazard 検出→正しく DEFER。次 = engine mini-wave (cluster 8種)。
- engine mini-wave #1 (朝): lpOverride_turn + $bound.levelSum → B01045/B01054/B04063 出荷 (1736→1739)。
  **BUG-179** = filter無し triggerCharMatches の partner 誤発火 (shipped 4枚) を lens 指摘から水平修正。
- engine mini-wave #2: viaNextHint 判別 + triggerCardMatches + $trigger.cardLevel → B01005/B03002/B05005 (1739→1742)。
- engine mini-wave #3: handToDeckBottom/filePopToHand n+gate/draw dyn → B03110/B03133/B05092 (1742→1745)。
  probe が出荷前 short-form collapse 2 件検出→contract 化。walk-literalize latent 記録。

## 2026-07-10 朝 — engine mini-wave #4 (hand 内 continuous level、cluster ⑧)
- **additive 2 primitive**: ContinuousModifier.lvlOverrideInHand / lvlDeltaInHand + 単一ソース helper
  effectiveHandLevel (hand-use-card.ts、colorIgnoreOnHandUse 同流儀 walk + condition honor +
  override先→delta 二段合成 rules/19)。consumer 4 site = levelAllowed / next-hint step2 /
  UI flows.toCandidate (表示 level も有効値) / handUseReason。validator JSON_CONT_KEYS +2。
- **cards 4 printings**: B01009/P 工藤新一 (override 4 + 宣言 selfToDeckBottom→LP0以下青を有効LP判定で
  アクティブ) / B09095/P ベルモット (delta -2 + 登場時 痕跡未発見 mill opp 2)。B07003 は cutin 動的付与
  = 別機構 DEFER 継続。shipped 1745→1749。
- probe 教訓: beforeEach 再登録は **event._resetRegistry() 必須** (欠くと triggered handler 累積 → N 重
  発火で偽 refresh 発生。miniwave3 慣行) / mutate.file.popTop は produce draft 内でのみ (Immer current)。
- gates: tsc0 / vitest 4604+1skip / smoke 472 exc0 / 8lint0 / crosscheck 14/14 / 混成 2-lens review。
