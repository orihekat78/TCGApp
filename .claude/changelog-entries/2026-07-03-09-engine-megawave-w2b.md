# engine mega-wave W2b — UI重 restriction 2 primitive (mustBeSelectedByOppEvent / mustGuard enforce) + exemplar 3 printings

- **r27 P50 `mustBeSelectedByOppEvent`** (B08087 吞口重彦「相手はイベントの効果によってこのキャラを選べる場合、必ず選ぶ」):
  ContinuousModifier flag + `read.char.selfContinuousFlag` union 追加。`forcedInclusionUids`
  (resolve-picks、source `def.kind==='event'` gate + chooser 相手側 + 候補内のみ「選べる場合」) を
  effect-pick 全 selection site が honor — human push は `pending.forcedUids` (UI enforce)、
  AI 同期 walk は picked override + generic multi 先頭合流、drain は `chooseAiPick`。
  forced > nMax は min clamp (公式Q&A「1枚まで×2枚→どちらか1枚」)。
- **r28 `mustGuard` enforce 層** (B09040 鈴木園子 a2「このキャラはガードできる場合、必ずガードする。」):
  `guard.mustGuardCandidates` (candidates() ∩ hasTextAbility、スリープ/ブレット/対象自身は候補外=
  強制免除が公式Q&A と自動整合) + `passGuard`/`tryGuard` fail-safe throw (義務 char 自身必須) +
  AI 2 site policy override + UI (useContactFlowDriver 候補絞り + GuardPickerModal pass 封じ banner)。
- **UI (human enforce 層)**: CardListModal forced auto-select+lock+完了 gate / Playmat scene 直接
  クリック restrict + skip 封じ / EffectPickerModal restrict + skip 封じ。
- **exemplar**: B08087 (a1 新 flag / a2 B08091 byte 同型 clone) + B09040/B09040P (a1 optional chain
  sleepSelf→discard bind→sceneRemove `levelMax:{dyn:'$discarded.level'}`、全部品出荷済 / a2
  charSetTurnEffect Pattern A pick + 絆京極真 + ターン1)。
- 検証: probe 22 tests (forced 全経路 on/off + Q&A edge 5種 + guard 義務 8種 + AI 2種 + exemplar) /
  tsc 両0 / vitest 3847→3869 回帰0 / smoke winsA=498 exc0 不変 / 8lint err0 /
  **playwright 実機 4 scenario** (①D11020 イベント使用→forced 以外 click 不可+skip 消滅+吞口解決
  ②human GuardPicker=義務 char のみ+「ガードしない」封じ banner ③B09040 a2 human 宣言 full path
  (levelMax6 filter で lv7 decoy 候補外) ④CPU defender 義務ガード強制) console err0 /
  敵対 review = sonnet5+opus 混成 2 lens。
