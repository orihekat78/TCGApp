# CARD PHASE step12 batch2 — declareName family 3枚 + DeclareCardNameModal 配線 + BUG-171/172/173

- **新カード 5 printings**: B09108/B09108P 工藤新一&服部平次 (MR — declareName 必須宣言 +
  fileRemoveTop/fileAdd + boundNameMatchesDeclared conditional + scope on-partner-area + カットイン) /
  B09003/B09003P 江戸川コナン (continuous lvlDelta −2 + 事件青&緑 enter observer + 絆服部平次 宣言
  declareName clone) / PR105 工藤有希子 (charSetCard 裏向きセット + 突撃[キャラ] turn grant +
  AP+1000 + 「してもよい」optional declareName → nameOverride 完全置換の初 live consumer)。
- **DeclareCardNameModal UI 配線** (W6 step1 scaffold → 実配線): useDeclareNamePicker (store+Promise) +
  Playmat mount + runDeclaredAbilityFlow 3.8 (dispatch 前に宣言名収集 → costParams.declaredName) +
  findDeclareNameAtom walk (optional 検出 = skip ボタン) + modal に onCancel 追加。
  playwright 実機: B09108 a2 human 全通し (autocomplete → FILE ops → 宣言一致 draw2 → discard2
  multi-pick) / PR105 skip・declare 両経路 / console error 0。
- **BUG-171 (engine 骨格バグ修正)**: 宣言能力の ctx.dyn が effect queue 境界で喪失 (costPaid のみ
  永続化) → declaredName チャネル全断。EffectStackEntry.dyn 永続化 + entryToCtx shallow-copy 復元 +
  charSetTurnEffect の未解決 '$' val guard (skip 時 nameOverride literal 汚染防止)。
- **BUG-172 (UI)**: 宣言能力 2 つ持ちの ability 択が picker.start (クリック面なし) で human flow hang —
  ChoicePickerModal (能力説明全文) に差替。既出荷 B05028/B05045/B06069 等の latent hang も一括解消。
- **BUG-173 (UI)**: selectInteractionLocked が resolved 残留 entry で ActionsPanel を永久ロック —
  pending|resolving フィルタ (BUG-151 規約) に修正。
- **batch1 の playwright 実機一括も実施** (DEFERRED-INDEX step12-batch1 (3) 解消): ヒラメキ suppress
  (B03126) + non-suppress 1 本通し / B01058 reserve fire human pick → スタン / B07014 rider 宣言列挙 +
  removeAreaToDeckTop pick / B05042 useEventFromHand human pick (lv7 decoy 除外・自身除外・skip) /
  B04072 アクション候補除外 UI。
- gates: tsc 0 / vitest **4130 pass +1 skip** (probe +17) / smoke winsA=472 baseline 一致 exceptions 0 /
  8 lint err 0 / 混成 review sonnet5+opus。
