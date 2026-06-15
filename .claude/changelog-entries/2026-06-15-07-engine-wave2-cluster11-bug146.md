# engine拡張 wave#2 cluster11 — BUG-146 修正 (効果登場の【登場時】不発火) + enterSource 4枚解禁

**Round/Phase**: 2026-06-15 engine拡張 wave#2 cluster11 (`engine/wave2-cluster11-enter-source`)。
enter-source-level filter (B01014/B01015/B01021/B07019) を、依存する **engine correctness バグ BUG-146**
(効果/能力による登場で entered char の【登場時】(selfOnly) が engine 全体で不発火) と **coupled** で同時出荷。
新 condition `enterSource` を追加。実装前に opus 7-agent ワークフロー (4 certify + 3-lens 敵対設計レビュー) で
全カード encoding を certify + emit-source 変更を red-team → **全 lens GO-with-fixes / 0 BLOCK**。

### BUG-146 修正 (骨格凍結原則 例外 = engine bug 修正)

- **根因**: `atom-handlers.ts` sceneEnter(:768)/sceneSwitch(:794) が enter emit の source に `ctx.source`
  (= 登場を起こした原因カード) を渡しており、`selfOnlyMatches`(source.uid===card.uid) で
  (1) 効果登場キャラ自身の【登場時】/【疾風】が永久不発、(2) 原因カードの【登場時】が誤発火 (28枚が対象) していた。
  rules/17「【登場時】能力/効果による登場でも発動」違反。
- **修正**: enter emit の source を **登場キャラ** `{player, uid: newChar.uid, cardId}` に統一
  (hand-use-card/next-hint の既存規約に収束)。原因カードは payload に `sourceCardId` を additive 追加。
- **水平展開 (敵対レビュー検証済)**: enter source arg の consumer は `selfOnlyMatches` と `sourceBindings` のみ。
  `ctx.source` は bindings を持たないため sourceBindings は元から undefined (no-op)。非 selfOnly enter listener は
  **PR117/PR118 のみ** (triggerCharMatches で payload.uid を読み source arg を読まない) = 不変。
  matcherCondition/ability.condition は listener identity + payload を読む = 疾風含め不変。
- **回帰更新 2件**: 効果登場した D01013(灰原哀)【登場時】が発火するようになり、BUG-146 由来の不発を前提にしていた
  `look-top-n-enterSleep` / `leave-reanimate-foreach-batch (PR155)` を正挙動に更新。

### 新 condition `enterSource` (4点同期)

- `types/effect.ts` union + `cond/eval.ts` case + CONDITION_KIND_MAP + `scripts/taskA-validate-specs.cjs` CONDS。
- `{ viaEffect?, sourceFilter?: TargetFilter }` — payload.viaEffect + payload.sourceCardId の **CardDef-static**
  filter 評価 (`matchOneFilter(state, sourceCardId, filter, null, cand)`、fileTopMatches 同流儀)。sourceCardId 不在は false。

### 解禁カード 4枚 (ALL_CARDS 1177→1181)

- **B01014 小嶋元太** / **B01015 円谷光彦** / **B01021 吉田歩美** (青/少年探偵団):
  【登場時】`or([enterSource{character,levelMin:3}, enterSource{event,levelMin:3}])`(viaEffect:true)。
  「レベル3以上」はキャラ・イベント両方に束縛 (certify 確認) → 効果 = Lv≤5 スリープ / AP+2000 / 1ドロー。
- **B07019 遠山和葉** (緑/高校生): 【解決編】【登場時】`enterSource{event,color:緑}` + `not(charStateIs self sleep)`
  (BUG-145 self-sleep gate、公式Q&A 準拠) → `optional{chain[sceneSetState self sleep, sceneRemove Lv≤7 either]}`。

### gate (全 green)

- tsc 0 / **vitest 2197 pass** (cluster11-enter-source.test.ts 16本: enterSource unit + 実 atom BUG-146 core/疾風/
  非誤発火/手動登場除外/cluster11 e2e + 既存2件更新) / validate-specs pass=73 fail=0 /
  **smoke baseline 不動** (winsA 498・avg 11.00→10.998・timeouts/exceptions 0、再 bless 不要) /
  **playwright 119 pass** / CI lint 全 errors0 / lint:icon-abilities OK (shipped=1181)。
