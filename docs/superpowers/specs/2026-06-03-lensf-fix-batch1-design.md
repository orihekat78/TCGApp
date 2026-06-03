# 設計: Lens F 監査 高確度修正バッチ1 (A/B/G) (2026-06-03)

MVP Lens F 監査 ([AUDIT-2026-06-03-mvp-card-lensf.md](../../../.claude/bugs/AUDIT-2026-06-03-mvp-card-lensf.md)) の
個人確認済 3 グループ (A/B/G) を修正。残り (C/D/E/F/H) は別バッチ。

## A (BUG-099): declared ability の `condition` を canDeclaredAbility で評価
`canDeclaredAbility` (declared-ability.ts:76-87) は findCardOnBoard + `limit` のみ判定し `condition` を無視。
declared ability の `condition` が未 gate (D08026 a2 解決編 / D11003 a2 婚活&警察2 / D11021 a2 解決編&神奈川県警1)。

**修正**: canDeclaredAbility に追加 (limit チェックの後):
```ts
if (ability?.condition) {
  const ctx = { source: { player: found.player, uid, abilityId: abilId, area: found.area }, bindings: {} } as EffectCtx;
  if (!evalCond(state, ability.condition, ctx)) return false;
}
```
import: `evalCond` (../../cond/eval.js)、`EffectCtx` (型)。UI/AI 列挙は canDeclaredAbility で gate 済 → 修正で自動波及。
triggered の condition gate は triggered.ts:172 で評価済 (不変)。

## B (BUG-100): 疾風 closure matcher → enterOrderEquals matcherCondition
D11003 a1 / D11009 a2 の `matcher:(p)=>p.enterOrder===1` は累積 `enterOrder` を見る (turn-local `enterOrderThisTurn` が正)。
D11014 a1 が正しい型 (`matcherCondition:{kind:'enterOrderEquals',n:1}`、enterOrderEquals は payload.enterOrderThisTurn を参照)。

**修正**: 両カードの trigger を `{ hook:'enter', selfOnly:true, matcherCondition:{kind:'enterOrderEquals', n:1} }` に置換。
closure matcher + 未使用になる `GameState` import を除去。engine 変更なし (enterOrderEquals 実装済)。

## G (BUG-101): D11005 挑発 (mustBeTargeted) — key 不一致 + scope 未配線
- **G1 (card)**: a2 は `args:{ ..., value:true }` だが handler (atom-handlers.ts:658) は `a.val` を読む → `mustBeTargeted=undefined` (dead-code)。`value:true` → `val:true` に修正。
  - targeting 強制は配線済 (target-expander.ts:168 / state-machine.ts:152-162 が `turnEffects.mustBeTargeted===true` を読む)。set さえ正しければ挑発は機能する。
- **G2 (engine)**: `scope:'opp-turn'` が未配線で永続化。clearTurnEffects は scope 'turn' のみ、endTurn は turn-player+両 scene の 'turn' 効果のみ清掃 (turn.ts:75-79)。
  - **修正**: `clearTurnEffects(s, uid, scope:'turn'|'opp-turn')` に拡張、'opp-turn' で `delete te['mustBeTargeted']`。
  - endTurn(p) に追加: 相手 (非p) scene の opp-turn 効果を清掃。
    ```ts
    const opp = p === 'self' ? 'opp' : 'self';
    for (const c of state.players[opp].scene) charMutator.clearTurnEffects(state, c.uid, 'opp-turn');
    ```
  - 根拠: D11005 a2 は自ターンに宣言→自 char に set。相手ターン中に強制→相手ターン終了時に解除。
    endTurn(A) は非A=B scene を清掃 (A の挑発は残る)。endTurn(B) は非B=A scene を清掃 (A の挑発が消える)。
    = 「相手のターン終了時まで」を正確に表現。

## ルール網羅性
- rules/17 §条件アイコン: 条件未達なら能力を持たない扱い → A (declared も gate)。
- rules/17 §【疾風 N】: このターン N 番目に登場 = enterOrderThisTurn → B。
- rules/07 §アクション対象 + D11005 テキスト「相手のターン終了時まで」→ G。

## エッジケース
1. A: 事件編で D08026 a2 宣言不可 / 解決編で可 (caseStatus gate)。D11021 a2 は解決編 AND 神奈川県警≥1 両成立時のみ。
2. A: condition の ctx.source.player は found.player (case は case:self→self)。caseStatus/sceneHas が正しい owner を見る。
3. B: 現場に前ターンキャラ残存時も当ターン1番目登場で発火 (enterOrderThisTurn=1)。selfOnly で自分の登場のみ。
4. G: 自ターン宣言→同自ターン終了では解除されない (非p=相手 scene のみ清掃)。相手ターン終了で解除。
5. G: 両者が挑発を持つ場合も対称に各々相手ターン終了で解除。
6. G: スタン状態キャラへの mustBeTargeted は targeting 側の既存挙動 (不変)。

## 水平展開
- A: condition を持つ declared ability は MVP で D08026/D11003/D11021 a2 のみ。triggered は gate 済。
- B: 疾風 closure は D11003/D11009 のみ (D11014 は既に正)。
- G: charSetTurnEffect の `val` 規約は他に MVP 使用なし。mustBeTargeted は D11005 のみ。'opp-turn' scope 効果も mustBeTargeted のみ。

## 検証
- tsc / vitest 全件 / smoke 1000 (D08026/D11003/D11005/D11009/D11021 は MVP デッキ所属 → AI 実走、condition gate / 挑発 / 疾風 修正で決着分布が動きうる、許容)。
- behavioral test: A (条件未達で canDeclaredAbility=false×3カード)、B (前ターン残存キャラ下でも疾風発火 / opp 登場で非発火)、G (val 設定で mustBeTargeted=true → 強制 / endTurn 後解除)。
- adversarial verify。BUG-099/100/101 起票。

## 関連
- 監査: AUDIT-2026-06-03-mvp-card-lensf.md。リファレンス: D11014 a1 (enterOrderEquals)、BUG-067 (limit gate)。
