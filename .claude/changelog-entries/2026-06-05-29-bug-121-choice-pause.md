## BUG-121 修正 — enter トリガの複数択 choice を human に選ばせる (engine pause 汎用機構)

**Round/Phase**: 2026-06-05 session — audit suspect 検証で検出した BUG-121 を案B (engine pause) で修正

### 背景

監査 suspect 検証で、B06007「【登場時】3択 (突撃/相手bounce/2ドロー)」が enter トリガ経由では
choice modal を出さず engine が option 0 (突撃) に既定化し、human が選べない不具合 (BUG-121) を検出。
宣言能力は `useActionsPanelFlow:606` が dispatch 前に choiceIndex を供給するが、enter トリガには
その経路が無く、engine も choice で pause しなかった。

### 修正 (案B engine pause、pick と完全同型・additive)

pendingEffectPick (human pick の pause/surface 機構) と 1:1 同型の `pendingEffectChoice` を新設:

- **engine pause** (`resolve-picks.ts`): choice case に「humanChooser && options>1 && chooser≠opp」で
  side-channel `__pendingEffectChoiceSide` に積み、空 effect (no-op parallel) を return する分岐を additive 追加。
  choiceIndex 指定済 (declared) / humanChooser=false (AI) / 単一 option は従来分岐に落ちて無傷。
- **再開** (`apply-pick.ts applyChoiceAndContinuation`): readDef から元 effect を復元 → choiceIndex 付きで
  再 walk → 選択 option へ unwrap → event.queue。option 内の $pick (B06007 option② sceneToHand) は
  既存 pick queue へ再 push され effectPickResolve で連鎖消化される。
- **UI**: `store.pendingEffectChoice` + `choiceResolve` action (useEngineDispatch) +
  `EffectChoiceModalHost` (既存 ChoicePickerModal/testid 再利用) + useEffectPickFlowDriver の AI fallback。
  lint:side-channel 4 点 (drain export / store field / dispatch 配線 / UI mount) すべて pass。

### 検証

- **Playwright** `audit-suspects-coverage.spec.ts`: handUseCard B06007 → 3択 choice modal →
  cp-opt-1 (option② bounce) → sceneToHand 連鎖 pick (相手 lv7 のみ・lv8 除外) → opp 手札へ bounce。
  修正前 fail (option 0 既定化・modal 出ず) → 修正後 pass を実機確認。
- 全 e2e **96 pass** / vitest **1781 pass** (bug-108-choice-index / review-hardening は新 pause 挙動へ
  characterization 更新、bug-077 のみ pre-existing 環境 flaky)。declared choice (choice-picker.spec) 回帰 0。
- typecheck clean / lint (eslint / side-channel / component-testid) errors=0。

### 影響 / 残課題

- 影響カードは B06007/B06007P の 2 枚のみ (declared / ヒラメキ / 単一 option choice / MVP は未影響)。
- sequence 内 human 複数択 choice は scope 外 (resolver の pause 検知が choice queue を見ない latent defect、
  該当カード 0 枚)。BUG-121.md に TODO 記載。骨格凍結原則の例外「choice 機構そのものの欠落補完」として実装。
