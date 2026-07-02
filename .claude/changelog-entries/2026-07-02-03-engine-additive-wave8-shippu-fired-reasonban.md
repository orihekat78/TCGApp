# engine additive wave-8 (P15 部分) — shippuFiredThisTurn flag + 推理不可付与 (canReason gate)

**Round/Phase**: 2026-07-02 engine-first フェーズ E2 structural wave-8。engine-extension-plan-2026-06-30 の
**P15 (疾風-発動済 per-turn tracking)** の Condition 消費部 + **推理不可付与** (B09072 a2 の第2 engine gate) を
origin/main (16b5bf98) 実 grep で genuine-absent 確認後に出荷。★grounding で **P05-P09 (カットイン抑止窓) は
stale-shipped** (wave-0629d `cutinBanOpp_action` turnEffect、TSV proposed 名 `cutinSuppress` と不一致で name-grep が誤検出)
と判明 → 着手対象から除外。**engine-only 出荷** (consumer カード B09072 は a2 の pick-bind carrier 不在で DEFER、下記)。

## engine 拡張 (pure-additive、既存カード write-only-inert / read-gate-inert = 挙動不変)

### [A] P15 `shippuFiredThisTurn` — 「このターン中 疾風が発動していたか」per-turn flag

「このターン中、自分のキャラの【疾風】が発動していた場合」(B09072 横溝重悟 a1) を可能にする per-turn 記録。

1. **`TurnScopedFlags.shippuFiredThisTurn?: boolean`** — [game-state.ts](../../src/engine/types/game-state.ts)。per-side turnState boolean
   (per-char turnEffect ではない) ゆえ **発動疾風キャラが離場後も履歴として残る** (「発動していた」= 歴史的事実、rules/17)。
2. **記録** — [triggered.ts `handleHook`](../../src/engine/listeners/triggered.ts): 全 gate (selfOnly / matcher /
   matcherCondition=enterOrderEquals / ability.condition / `!effect` / limit turn) 通過後・queue 到達点で `abilityIsShippu(ability)`
   なら発動キャラ owner (`card.player`) 側を true。rules/24 に従い **発動時点** (効果解決不能でも「発動した」扱い) で記録 =
   到達点が正しい定義 (insertion 後に skip する gate は無く必ず queue される。opus semantic lens 実証)。`abilityIsShippu` =
   enter + selfOnly + enterOrderEquals で **【登場時】(matcherCondition 無し) と区別**。付与 (grantedAbilities) 由来の疾風も該当。
3. **消費** — 汎用 Condition `{kind:'flag', player:'self', key:'shippuFiredThisTurn', v:true}` で読む
   (`flag.key: keyof TurnScopedFlags` ゆえ field 追加のみで型 valid、**新 Condition kind 不要**)。
4. **清掃** — [turn.ts `endTurn`](../../src/engine/flow/turn.ts) の両プレイヤー loop で `= false` (primary、driver 非依存) +
   [flag.ts `resetTurnFlags`](../../src/engine/mutate/flag.ts) backstop (hiramekiSuppressed と同 posture)。両プレイヤー清掃ゆえ
   相手ターン発動 → 次自ターンで stale 化しない (cross-turn 閉鎖、opus lifecycle lens 実証)。

### [B] 推理不可付与 (`cannotReason` turnEffect + canReason gate)

「このキャラは推理できない。」(B09072 a2、ターン終了時まで) を可能にする reason-ban。

1. **[reasoning.ts `canReason`](../../src/engine/flow/main/reasoning.ts)**: char 分岐の active-state check 後・isNamed/迅速 分岐
   **前**に `if (turnEffects['cannotReason']===true) return false` = 名乗り/迅速に優先する絶対制限 (rules/11)。
2. 付与は **既存 `charSetTurnEffect` verb** (key:'cannotReason') を流用 (新 verb 不要)。清掃は
   [char.ts `clearTurnEffects('turn')`](../../src/engine/mutate/char.ts) の delete list に追加 (actedCharThisTurn 同様の boolean flag key)。

## 検証 (セルフレビュー + 水平展開 + opus 4-lens 敵対 review)

- **opus 4-lens 敵対 review (semantic / additivity / lifecycle / edge-coverage) = 全 SHIP・blocker 0**。反映 nit:
  ① semantic/edge: cannotReason が名乗り+迅速 char にも優先する絶対制限であることを test で pin (gate 配置の load-bearing 性)。
  ② edge: 疾風発動キャラの離場後も記録が残る departed-history test 追加。
  ③ lifecycle: endTurn 清掃が phase:end:cleanup (turn-end trigger queue の後) ゆえ将来「ターン終了時 疾風〜」consumer は
     queue 時評価の `ability.condition` で読むこと、を field doc に明記。opp-side record (card.player='opp') は collectCardsInPlay
     構築で保証ゆえ test は self-side + departed で担保 (opp 召喚は sceneEnter の相対解決で test が脆く不採用)。
- tsc 0 (両 tsconfig) / vitest baseline (16b5bf98=3589) **→ 3602 pass** +1 skip (新規 13: record 4 [self/departed/非疾風decoy/2番目未成立]
  / flag-cond 3 [true/undefined/opp 分離] / reset 2 [endTurn 両者・resetTurnFlags] / cannotReason 4 [unset可・set不可・迅速優先・clear復帰])。
- smoke:1000 **winsA=498・winsB=502・timeouts/exceptions 0** = baseline 不変 (疾風 write は全 1000 戦で発火するが reader 皆無 =
  write-only-inert / cannotReason は既存カード未設定 = gate-inert)。8 CI lint errors=0。
- playwright: engine-only (consumer カード無) ゆえ N/A。picker 経路検証は consumer カード出荷時 (card-wave)。

## DEFER (別 wave / card-wave)

- **B09072 横溝重悟 (consumer カード)**: a2「〚特徴[神奈川県警]〛のキャラを1枚まで選び、アクティブにし、ターン終了時まで
  推理できないを与える」= **pick-bind carrier を要する** (sceneSetState / charSetTurnEffect は bind 非対応、pure-pick-bind verb 不在)。
  「select 1 char → 2 rider (activate + reason-ban)」の共有 pick 機構が現 primitive に無いため card-wave (要新 picker or 実機経路 empirical)。
- **P15 TargetFilter 軸** (B09070 萩原千速&研二 ターン終了時「疾風発動した全キャラを active化」): per-char turnEffect + matchOneFilter honor +
  turn-end queue-time timing 検証が要 + B09070 は removeArea-filtered-select / PA-declared の第2・第3 gate 併存 = 非 sole。
  Condition 消費で十分な本 wave では見送り。
- boundDistinctColorCount (B07002、G17 残) / P16 疾風条件 override (B09090) は engine-extension-plan の別 primitive。

engine-extension-plan-2026-06-30 進捗: E2 structural P15 (Condition 消費部 + 推理不可付与) 出荷、TargetFilter 軸は DEFER。
