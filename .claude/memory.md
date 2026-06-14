# 作業ログ — 名探偵コナンTCG プロジェクト

> 前セッション① (BUG-143/144 + cluster8、5 commit) は本セッション冒頭で push 済 → [sessions/2026-06-15.md](sessions/2026-06-15.md)。

## 2026-06-15 セッション② — BUG-145 self-sleep optional gate (self-state micro-cluster)

origin/main は session① の 6 commit (5 + docs) を push 済 (CI green)。本セッションは BUG-145 を実装。

### やったこと
- **BUG-145 起票時 PR138 1枚 → 水平展開で 11 能力**。「このキャラをスリープさせ(…)てもよい。そうした場合 X」型は
  解決時 self が既スリープなら optional 自体不可 (公式qAndA PR138/PR144/B04049「スリープさせることが
  できないので行えません」= 一般裁定)。`sceneSetState{$self,sleep}` 冪等で chain break せず違反していた。
- **engine**: `Condition` union に `charStateIs{ref,state}` 追加 (effect.ts/eval.ts case/CONDITION_KIND_MAP/
  taskA-validate-specs.cjs CONDS の **4点同期**)。ref 解決は apAtLeast 同流儀 (resolveCharsForRef→charRead.state)。
- **gate は ability.condition で行う** (effect 側 `conditional` ラップは不可: resolveEffectPicks が両枝を walk →
  optional **prompt** が surface してしまう。triggered.ts:226-238 は condition=false なら walk 前に continue =
  非所持扱い rules/17)。最初 conditional ラップで実装→専用 test の sleep ケースで surface 検出→ability.condition に pivot。
- 11 能力に `not{charStateIs(ref:self,state:'sleep')}` を AND マージ (codemod `.tmp/gate-codemod2.mjs`)。
  既存 condition (B04049 partnerColor / B06102・B09065 turn / B08058・B08058P fileAtLeast) は and:[既存,gate] で維持。
  B09013 は a2 のみ (limit turn1 別管理、a1 は他キャラ sleep で非対象)。
- **sleep のみ gate** (active 案=DEFERRED当初案 は不採用)。⚠ 公式 **sleep/stun 非対称**: 自スタン PR157/PR163 は
  already-sleep でも可 (qAndA「スリープ状態で登場した場合スタンさせることはできますか→はい」)。active gate なら誤阻害。

### 対象 11 能力
- enter 明示qAndA: PR138/PR144 (黒ずくめ reanimate) / B04049 (FBI remove)
- enter 一般裁定: B09058/B09058P (赤井家) / B09057 (黒 summon) / B08058/B08058P (FILE8 deck-bottom)
- ターン終了時 (到達性高): B06102 (キャンティ) / B09065 (FBI)
- action:declare【ターン1】: B09013 a2

### gate (全 green)
- tsc / validate-specs 73-0 / sync-whitelists 5 / **full vitest 2148** (+35 専用 test) /
  smoke:1000 = **baseline 不変 winsA=498** (already-sleep は random play 不到達の証跡) / playwright 119 / eslint+card-lint clean。
- 専用 test `tests/cards/bug-145-self-sleep-gate.test.ts` 35件 (primitive / 11能力 sleep→false・active→true /
  AND-merge 非破壊 (B06102 turn) / 実パイプライン enter-hook emit で sleep→pendingEffects 空)。
- **敵対 verify (opus×14)**: 11能力 全 CORRECT / 除外 13枚 MISS 0 / 自スタン PR157/PR163 除外確定。

### 教訓 (BUG-145.md に詳細)
- **effect 側 conditional ラップは optional prompt を gate しない** (walk が両枝を訪れる) → 状態 gate は ability.condition。
- certify green でも意味等価は自前1対1突合 (B01011/PR138)。bug doc 1枚でも同構造を機械抽出して水平展開。

### branch / 残課題
- branch `fix/bug-145-self-sleep-gate` で commit → main ff-merge → push 予定。
- BUG-143/144/145 の commit プロパティは branch名 placeholder (real hash 反映は任意)。
