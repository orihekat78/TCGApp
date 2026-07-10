# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-07-10.md](sessions/2026-07-10.md) (M1 mega-sweep + M2 attribution mini-wave 1867/2074)。
> 再開手順: Track A = `.claude/NEXT-SESSION-PROMPT.md` / Track B = `.claude/NEXT-SESSION-PROMPT-TRACK-B.md`。

## 2026-07-10 夜2 — M2 後半 batch (session: m2-latter)
- engine additive 15 点 (mill dyn/drawUpTo bind/hdb dyn+shuffle/sceneEnter bind/faceUp honor/bindRef/
  toHandOnTurnEnd/cutinTextIncludes/lvlDeltaInHandPer/chooser source/Cost×2/rider walk/area union/
  resolver walk-literalize guard) + 15 unit + PR240 + P spread 14 = **+30 printings (1867→1897、残 177)**
- T2 混成 review: semantic BLOCK1=誤検出 (一次資料裁定)、edge BLOCK3=同 wave 修正 (半角＋/side/union順)
- M3/M4/M5 grounding 前処理を待ち時間で完了 (specs/grounding/ 永続化、M4=SG5+BLOCKED3、M5=SG4+BLOCKED4)
- 新規約: Agent model 未指定禁止 (CLAUDE.md 表) / cutin description AP＋全角必須 / gen-p-spread CONAN_ROOT

## 2026-07-10 深夜 — M3 PA batch (session: m3-pa)
- UI 基盤 6 site: enumDeclaredAbilitySources partnerMR source + enumDeclaredAbilityIdsFor partnerMR 分岐 /
  flows resolveDeclaredSourceCardId+owner解決 (partnerMR:+hand: 両対応、costText area も正規化) /
  uidNames partnerMR / ai/ability-ctx + move-enumerator 6c (BUG-084 同型予防) / PartnerArea MR tile + Playmat 配線
- probe: pa-mr-declared 5 + move-enumerator.pa-mr 3 + scope-flip 8 / e2e m3-pa-mr-declared.spec.ts green
  (tile→candidate→confirm 名解決→decoy 除外 pick→lvlMod_turn 反映→console error 0)
- scope flip 11 file (B07079/P B08032/P B09054/P B07093/P B05066/P B05045、P は spread or 全複製)
- triage: 登録済 18 = DONE8/UI_UNLOCKED9/SCOPE_FLIP1 (B05045) / 未登録 14 = UI_UNLOCKED3 (author 中)
  +SMALL_GAP11 (engine 3 cluster: paCards source zone / toPartnerArea pick / removed-card snapshot root)
- ★水平展開: rules/19 複数名 names 分割漏れ 23 枚発覚→BUG-185 一括修正 + names-split.lint.test 恒久 gate
- triage 二次 finding「B05106 chain で draw が decline でも走る」は**偽** — chain-origin skip は
  「そうした場合」gate で remainder skip (apply-pick.ts:228-230 実読)。chain = 正しい idiom
