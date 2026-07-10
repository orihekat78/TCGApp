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

## 2026-07-10 深夜2 — M3 PA batch (session: m3-pa、origin 02a00e57)
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

## 2026-07-11 夜間自走 Wave 0 (session night-run)
- W0 出荷: cost-choice UI (flows 3.6 ChoicePicker, B09027+P) + EffectPickerModal multi-select
  (perSideMax quota + nMin clamp, B08019+P) + removeSetCard anyFace (B05052) + GREEN 6
  (B07099/B01020/B03111+P/B01077/B07102/B05117+P) = +13 printings (1903→1916)。
- ★BUG-186 修正: sceneEnter 短縮形 side 絶対値渡し→owner=opp 反転 (BUG-174 同族)。
  水平展開: hand 系 atom ~10 site 同族 latent = BUG-187 起票 (discard は B01077 probe pass だが
  fixture 対称性の偽陰性可能性 — side 非対称 fixture で要再検証)。
- 原則 DEFER 3: B09081 (hirameki optional humanChooser 無し collapse、B06032 同根) /
  B09052 (cutin declareName dyn queue 不達 B01095 同根 + excludeBoundKey 不在) /
  B09110 (deckRevealUntil match 早期停止不在 + PA self-remove 不達)。
- grantKeywords は関数 shape (`() => ['突撃']`) — 配列 literal は grantFn is not a function (read/char.ts:441)。
- e2e buildGameState fixture callback は page serialize — 外側 closure helper 参照不可、inline 必須。
