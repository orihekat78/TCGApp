# wave engine-removed-char-filter — removedCharMatches.removedFilter 拡張 + 離場キャラ属性 observer 6枚

**Round/Phase**: 2026-06-23 engine拡張 wave (engine session、additive)。離場キャラ **自身** を色/特徴/レベル/状態で
gate する removal-observer (「自分の現場にいる【赤】のキャラがリムーブされたとき」等) を解禁。棚卸「leave-trigger
soleGate 57」を全 member full-text grounding した結果、大半は既に engine 対応済 (leave:to-remove hook +
removedCharMatches side/cause/by = cluster15) で、真の gap = **離場キャラ自身の属性 filter** (universe 走査で 8枚) と判明。
cluster15 設計 D2/D3 が `removedFilter` を forward 予約していた箇所を実装。

## engine 拡張 (additive、touched engine = 3 files)

- **types/effect.ts**: `removedCharMatches` 条件に `removedFilter?: TargetFilter` + `removedState?: ('active'|'sleep'|'stun')[]`
  を additive 追加 (既存 side/cause/by はそのまま)。
- **mutate/scene.ts**: `removeToRemove` の `leave:to-remove` payload に離場キャラ snapshot `removedChar: char`
  (splice 前の char ref) を additive 付与。既存 consumer (selfOnly【現場リムーブ時】/ side·cause·by observer) は本フィールドを無視 = 回帰0。
- **cond/eval.ts**: `removedCharMatches` に removedState (snapshot.state を明示判定) + removedFilter (matchOneFilter)
  の評価を追加。matchOneFilter は level を **char.turnEffects 由来**で読むため、snapshot 渡しで splice 後も
  **修正後(effective)レベル** (rules/19) が同期 eval 中は正しい。state は TargetFilter に無く matchOneFilter が
  見ないため removedState で独立判定。

新 condition KIND は増えない (既存 kind に field 追加のみ) → sync-taskA-whitelists.test は通過。新 verb/cost/hook なし。

## 追加カード (6、ALL_CARDS 1417 → 1423)

- **B01075 宮野明美** (赤3): a1=【相手ターン中】【ターン1】このキャラか自分の現場の【赤】が除去 → draw1 + discard1
  (自身が【赤】ゆえ removedFilter{color:赤} side:self で self-leave 被覆)。a2=【ヒラメキ】カードを1枚引く。
- **B01089 佐藤美和子** (黄5): a1=同型【黄】→ draw1。a2=【ヒラメキ】キャラを1枚まで選びスリープ。
- **B03092 / B03092P 高木渉** (黄5): 【相手ターン中】【ターン1】自分の現場のレベル6以上の〚警察〛が除去 →
  レベル7以下のキャラを1枚まで選びスタン。removedFilter{trait:警察,levelMin:6} は effective level 判定。
- **B05059 / B05059P 白馬探** (白8): a1=【相手ターン中】【ターン1】スリープ状態のこのキャラ/自分の現場のスリープ状態の
  〚探偵〛が除去 → draw1 (removedFilter{trait:探偵}+removedState[sleep]、自身探偵で被覆)。a2=【宣言】【ターン1】
  〚このキャラ以外の探偵を1枚スリープ〛: AP8000以下を1枚まで選びリムーブ。

## DEFER (2、別 engine gap)

- **B04055** アマンダ・ヒューズ: a1 effect「公開カードがリムーブされたキャラの特徴を持つ場合手札に加える」=
  reveal filter を離場キャラの動的特徴でパラメタ化する機構が engine 不在 → 全体 DEFER。
- **B07096** ウォッカ: a1 (相手Lv4以下除去→draw) は removedFilter{levelMax:4} side:opp で clean だが、印字 keyword
  〚突撃［レベル4以下のキャラ］〛= 条件付ターゲット突撃が engine 未対応 (silent no-op は不誠実) → 全体 DEFER。
  → 両者 .claude/specs/DEFERRED-INDEX.md に解禁条件付きで起票。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-removed-char-filter-2026-06-23.test.ts、25件): color/trait/level/state/side 各軸の
  1対1 witness + decoy (wrong color/level/trait/state/side) + **effective-level via snapshot** witness (base Lv5警察を
  +1 buff→除去で発火 / base Lv6を-1 debuff→非発火) + self-leave 経路 removedChar 搬送 + turn-gate decoy +
  実出荷6カード integration (相手ターン中駆動) + 印字【ヒラメキ】a2 構造 pin (B01075/B01089)。
- **敵対 faithfulness review** (opus、4 card-lens) が **2 BLOCKER 検出** = B01075/B01089 の印字【ヒラメキ】(TSV col12)
  実装漏れ。grounding が col10(effect) のみ照合し col11/12/13 (cutIn/hirameki/henso) を見逃した authoring miss を
  最終ゲートで捕捉。同 wave 内で a2 補完 (B01011/B01091 a2 = 既出荷 exemplar verbatim) し解消。B03092/P・B05059/P は PASS
  (effective-level/removedState/snapshot/additive を engine コードで逐条確認)。
  > 教訓: カード grounding は **col10 だけでなく col11(cutIn)/col12(hirameki)/col13(henso) の印字能力を必ず全列照合**する。
- typecheck 0 (両config) / engine diff = additive のみ (3 files、新 field/payload-field のみ既存行ゼロ変更) /
  vitest 2910→2935 (+25、baseline 不変) / 既存 leave/removal-observer 回帰 65/65 / smoke winsA=498 exc0 baselineOK
  (engine payload に removedChar 追加だが既存カード無参照 + RNG 不変 = baseline 完全一致) / e2e 124 / pre-commit。
- **engine lens PASS** (additive/回帰ゼロ/Immer draft-in-payload 安全/effective-level via snapshot/state gate を実コード確認)。
  latent gap 1件報告: removedFilter の **AP/LP 軸**は continuous/aura delta が spliced char で 0 化し不正確 (出荷カードは未使用ゆえ未踏、
  effect.ts type コメントに DEFER 注記)。
