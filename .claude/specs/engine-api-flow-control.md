# engine.flow.* — フェイズ/アクション/コンタクト制御

ゲームフロー全体の駆動と、各種行動の宣言→解決の制御。
カードからは原則 **読み取りのみ** (`canX`)。実際の遷移は engine が行う。
rules: [05](../rules/05-turn-phases.md), [07](../rules/07-action-flow.md), [08](../rules/08-contact.md), [22](../rules/22-qa-action-contact.md)

## ターン / フェイズ

```typescript
engine.flow.startTurn(state, p): void              // turn:start emit
engine.flow.runAutoPhase(state, p): void           // ①パートナー active ②キャラ active ③ドロー ④FILE
                                                    //  各ステップは可能でなければスキップ (rules/05)
                                                    //  先攻初手は FILE 1枚だけ (rules/04)
engine.flow.startMainPhase(state, p): void
engine.flow.endTurn(state, p): void                // 終了時能力解決 → ターン中効果切れ → 次ターン

engine.flow.canEndTurn(state, p): boolean          // 未解決効果がない
engine.flow.canSolveCase(state, p): boolean
  // - 事件=解決編
  // - evidence >= requiredEvidence
  // - partner active
  // - assistedThisTurn=false (rules/01)
```

## メインフェイズ 6 行動

`canX` で UI 側のボタン活性、`doX` で宣言→engine が解決。

```typescript
// 01. 手札の使用
engine.flow.canHandUseCard(state, p, cardId): boolean
engine.flow.handUseCard(state, p, cardId, ctx): void
// 02. ネクストヒント
engine.flow.canStartNextHint(state, p): boolean
engine.flow.runNextHint(state, p, optionalCardId): void
  // FILE最上部 → 手札 (アシスト中パートナー除く rules/12)
  // optionalCardId 指定で 1枚使用 (色制限あり、登場キャラは named:true)
  // 1で加えたカード自身も使用候補だが、FILE枚数判定には数えない (rules/12)
// 03. パートナー能力
engine.flow.canPartnerAbility(state, p, abilId): boolean
engine.flow.usePartnerAbility(state, p, abilId, ctx): void
// 04. 宣言能力
engine.flow.canDeclaredAbility(state, uid, abilId): boolean
engine.flow.useDeclaredAbility(state, uid, abilId, ctx): void
// 05. 推理
engine.flow.canReason(state, uid): boolean
  // active + 名乗りなしor迅速 + LP参照は解決時 (rules/11)
engine.flow.doReasoning(state, uid): void
  // sleep化 → reasoning:before-add (LP取得) → 証拠 max(LP,0) 枚 (rules/11 LP≤0 は0枚)
// 06. アクション
engine.flow.canAction(state, byUid): boolean       // 名乗り例外: 突撃/突撃[X]/迅速 (rules/13)
engine.flow.canActionAgainstChar(state, byUid, targetUid): boolean
engine.flow.canActionAgainstCase(state, byUid, p): boolean
                                                    // 相手証拠1以上必須 (rules/07)
```

## アクション / コンタクト 状態機械 — rules: [22](../rules/22-qa-action-contact.md)

```typescript
type ActionPhase =
  | 'declared'           // 宣言・スリープ化済
  | 'guard-window'       // ガード判定中
  | 'leave-resolution'   // 【現場リムーブ時】解決中 (ガードと コンタクト発生 の間)
  | 'contact-pending'    // コンタクト開始前
  | 'contact-order-pending' // 「コンタクトしたとき」効果の解決完了待ち。解決後APで行動順決定、参加者不在なら contact-end
  | 'action-1'           // 1番目行動
  | 'action-2'           // 2番目行動
  | 'action-1-redo'      // 1番目再行動 (1番目pass & 2番目行動時のみ)
  | 'judge'              // AP判定
  | 'contact-end'
  | 'action-end';

engine.flow.action.declare(state, byUid, target): ActionContext
engine.flow.action.tryGuard(state, ax, guardUid): void
engine.flow.action.passGuard(state, ax): void
engine.flow.action.advance(state, ax): void              // 次フェーズへ
engine.flow.action.abortIfMissing(state, ax): void
  // ガードまでに攻撃キャラ or 対象が現場を離れた → 終了 (rules/07)
engine.flow.action.snapshotAP(state, ax): void           // contact:before-judge 直前
```

## アクション対象拡張 / 強制指定 (G28, G29)

カード固有の対象拡張・指定強制をプラガブルに受ける機構。

```typescript
// G29: アクション対象判定の拡張点
engine.flow.action.registerTargetExpander(uid, expander): Unsubscribe
  // expander(s, byUid) => candidates[]
  // 通常 (rules/07: 相手のスリープ/スタン) に追加して返す
  // 例: D11007 「相手のレベル7以上アクティブも指定可」

engine.flow.action.candidates(state, byUid): Candidate[]
  // 通常候補 + registerTargetExpander 経由の追加候補

// G28: 強制指定モード
engine.flow.action.mustTargetCandidates(state, byUid): Candidate[]
  // turnEffect.mustBeTargeted=true のキャラがいる場合、それを必ず含む候補
  // 例: D11005 挑発効果中
engine.mutate.char.setTurnEffect(s, uid, 'mustBeTargeted', true): void
  // engine.flow.action.declare 実行時にチェック
```

## コンタクト中 行動 / アクション[事件] / ガード

→ [engine-api-flow-contact.md](engine-api-flow-contact.md) に分離。

## 関連
- [engine-api-resolver.md](engine-api-resolver.md)
- [engine-api-events.md](engine-api-events.md)
- [ui-action-flows.md](2026-05-11-ui-action-flows.md)
