## fix(engine): BUG-161 conditional pre-walk over-fire 根治 (binding-aware gate)

- `resolveEffectPicks` の `case 'conditional'` が then/else **両枝を無条件 walk** → `if` を無視して非taken 枝の
  choice/optional/$pick が eager-surface (= human 経路で余計な modal)。runtime は正しく taken 枝のみ実行するので
  **pre-walk 専属の surface バグ**。shipped **B06094 高木君のおごり** 等 8 family で if=TRUE 時に else-choice が出る。
- BUG-145 §修正方針2 が「effect 側 conditional は optional prompt を gate しない」と既に記録し ability.condition で
  回避していた制約の **根治**。
- ★naive な `evalCond(if)?walk(then):walk(else)` は **deck-look family 約150枚を regress** (B06048 解決編 red、
  discard 不発火: conditional が非先頭 step で `if` が前 step の `$matched`/`$revealed` binding 依存 → pre-walk で
  binding 未設定 → stale-FALSE)。
- **正解 = binding-aware gate**: helper `conditionIfIsStable` (bound/boundMatchesFilter→unstable、not/and/or 再帰、
  default `!JSON.stringify(cond).includes('$')`)。**stable な if のみ** taken 枝 walk (非taken RAW)、**unstable は両枝 walk**
  (byte-compatible、deck-look 保護)。runtime 再評価で double-eval safe。
- 検証: TDD red→green (unit resolve-picks.test.ts +stable-true/false/binding 3例、card-level B06094 +2例) /
  tsc0 / full vitest 3275 pass 0 fail / smoke winsA=498 exceptions=0 baseline 不変 / opus 敵対 review。
- 触touched engine = resolve-picks.ts のみ (1 helper + conditional case)。骨格凍結 例外「engine 自体のバグ修正」。
- B05062 の gate#2 として依存 (残 gate#1 removeUnionAtLeast condition + gate#3 TargetFilter.anyOf は Part B、別 session 予定)。
