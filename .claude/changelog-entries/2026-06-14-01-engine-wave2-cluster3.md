# engine拡張 wave#2 cluster3 — action-lifecycle trigger 族 解禁 15枚 + 骨格バグ2件修正

**Round/Phase**: 2026-06-14 engine拡張 wave#2 cluster3 (`engine/wave2-action-triggers`)。
「アクションのライフサイクル (宣言 / 証拠獲得 / 終了) に反応する trigger」族を解禁。
調査 7 lens → 敵対設計レビュー 3 lens (approve-with-fixes、major 7 全反映) で設計確定。

### engine 拡張 (additive 6 + 既存骨格バグ修正 2)

- **X9 evidence:gain emit 新設** (`flow/action-case.ts`): アクション[事件] の自証拠獲得時のみ emit
  (推理/効果/refresh 由来では発火しない = 「アクション[事件]によって」の語義を構造的に保証)。
  実獲得時のみ emit + refresh guard 込み (false-fire 防止)
- **X10 TRIGGERED_HOOKS に `action:end` / `evidence:gain` 追加** — card-triggerable 化 (cjs whitelist 同期)
- **X11 新 Condition `triggerActionKind {v:'char'|'case'}`** — action:declare の subtype gate を JSON 純化
  (`and` 複合で triggerCharMatches と併用。granted descriptor の matcher 関数禁止に対応)
- **X12 scope:'action' modifier の read/filter 合算** (read/char.ts + candidates.ts + ModScope + 3 cast) —
  「アクション終了時まで AP±」を解禁。清掃は既存 clearTurnEffects('action') + turn-end safety net
- **X13 action:declare payload に flat `targetUid`** — 「指定したキャラ」(B08048) を $trigger.targetUid /
  triggerCharMatches{payloadKey:'targetUid'} で参照可能に
- **X16 contact driver の pause gate 拡張** (BUG-141): pendingEffectOptional / Choice 解決前に guard 窓へ進まない
- **X14 = BUG-141** (CPU declare-trigger drain 順序): 宣言時 trigger の効果をガード判定**前**に解決
  (rules/22 R1。char/case 両経路に declare 直後 drain)
- **X15 = BUG-142** (evidenceGain verb refresh guard): 証拠獲得のデッキ枯渇時 refresh (rules/14、BUG-137 同族)

### 解禁カード 15枚 / DEFER 1枚

- a群 action-subtype trigger 7: B01036 / B01037 / B01068 / B02068 / B03097 / B08048 / D04005
- b群 evidence-gain-by-action 4: B08012 / B08012P / B01067 / D04007
- c群 action:end 4: PR086 / PR092 / B03073 / B05108
- B08012P / PR092 は gameplay 列 byte 一致の再録 (full def 複製)。ALL_CARDS 1140→1152
- **DEFER B06049** (a2「相手の【ヒラメキ】は発動しない」= 抑止機構が engine 不存在、partial 出荷不可)

### ルール追記

- rules/22 — R1+R4 (宣言時 trigger はガード判定前に発動・解決、両プレイヤー対象) を既存行に改稿 +
  R2 (アクション終了時 = 現場在場時のみ) / R5 (アクション終了時まで = アクション毎失効) を追記
- rules/25 — R3 (同一効果内の後段条件は前段適用後の状態で評価、B08048 Q&A)

### 検証

- TDD 先行 pin 25 件 (`tests/engine/effect/wave2-cluster3-action-triggers.test.ts`) +
  カード構造アサーション 15 件 (`tests/cards/cluster3-action-triggers.test.ts`)
- 全ゲート green: tsc / validate-specs 70/0 / full vitest 2064 / **smoke:1000 baseline 完全一致**
  (X14/X15 の reorder/refresh は現 smoke デッキの結果に影響せず = 挙動保存の回帰証跡) / e2e / MCP 実機 decoy
- 新規 BUG: 141 (修正済) / 142 (修正済、reasoning 同族は繰越) / 143 (contact mod 清掃、繰越) / 144 (case guard 窓、繰越)
