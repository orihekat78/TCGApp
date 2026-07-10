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

## engine A1 wave (2026-07-11、subagent) — verb/zone 系 5 rep
- SHIP 3 primitive (additive, byte-safe, 骨格凍結内): 
  1. **handAddFromRemove area union** (core.ts array 分岐 ~L998): remove∪partner-area splice。exemplar **B07049** フィリップ王子。
  2. **charStackCard fromScene** (char.ts atomCharStackCard, fromSelf の鏡像): 現場キャラを host($self)下へ重ねる。hostUid を pick 前に args 注入 (re-dispatch で ctx.source.uid drop 対策)。exemplar **D10009 + D10010** 工藤新一。
  3. **charGrantTrait/charRevokeTrait** (新 verb, 3点sync済): permanent=turnEffects grantedTraits_permanent/revokedTraits_permanent (clearTurnEffects で消さない=「ターン終了時に切れない」) / turn=_turn (清掃)。**両 honor site** = read.char.traits + candidates.matchOneFilter。変装は disguiseInto(cardId のみ差替) で自動引継ぎ。
- probe: tests/cards/night-wA1/ (B07049 4 / D10009 9 / trait-grant-revoke 6 + sync)。全 24 green。full vitest 5206 pass 回帰0。
- DEFER 3+1: **B06005 a2** (重なりカード「2枚まで」= fungible count-choice UI primitive 不在) / **B09078** (dual-filter deck-look 3→白黄char+白黄event 二重pick + reveal-to-remove、複合新primitive) / **B09039** (a1 は union verb で可だが a2 の handAddFromRemove「加えた場合」chainStepNoApply gate 不在→過剰discard、既存consumer 影響リスク) / **B05101 card** (verb は SHIP+test 済。self-revival-by-cardId idiom 不在=$self.cardId 未解決/payload に cardId 無 + optional-chain 層で card 全体 DEFER)。
- 未登録: 3 card は _reuse/index.ts 未登録 (指示「登録は main loop」)。probe は直接 registerCardDef。

## Wave A (engine additive、同夜)
- A1-A3 cluster + 刈り取り = 19 printings 出荷 (1916→1935)。新 primitive 12 点 (詳細 changelog-entry 02)。
- ★T2 review 実 BLOCK 検出→修正: removeDeckAll コスト時 refresh 未発火 (公式Q&A 違反)。probe が
  バグを pin していた実例 — 「probe green ≠ 意味正」、Q&A 列突合 lens は費用対効果あり。
- DEFER 6 (B05101 card/B06005/B09078/B09039/B08002 card/B08078) — blocker を DEFERRED-INDEX へ。

## Wave B (param 拡張、同夜)
- WB1 5/6 + WB2 4/4 = 13 printings (1935→1948)。T2 review BLOCK: B05075「してもよい」bare chain
  (decline 権剥奪) → optional 化。★agent の「strategically 常に有利だから optional 省略」は
  忠実性違反 pattern — 印字の選択権は常に DSL に写す (D04007 idiom)。
- B06027 DEFER: evidence:remove-by-action 時点でカードは remove に移動済 (removeTop が先) —
  「証拠から登場」系は remove-source 自己参照 or removeTop タイミング再設計 (骨格) の設計判断要。
