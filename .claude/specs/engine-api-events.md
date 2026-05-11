# engine.event.* — イベントHook 一覧

カードは Hook を **登録** することで「〜したとき」を表現する。
新Hookの追加は骨格修正となるため、ここに事前定義する全Hookを列挙する (40+)。

## 登録 / 発火

```typescript
engine.event.on(name: HookName, listener: Listener): Unsubscribe
engine.event.emit(state, name, payload): void          // 内部のみ
engine.event.queue(state, effect, source): void        // pendingEffects 追加
type Listener = (state, payload, source) => Effect | void;
```

- 発火時、Listener が `Effect` を返すと **pendingEffects に積まれる** (rules/15)
- `void` 返却 = 副作用なし (常時有効型は本来 listener 不使用)

## 行動系 — rules: [05](../rules/05-turn-phases.md), [22](../rules/22-qa-action-contact.md)

| Hook | 発火タイミング | payload |
|------|--------------|---------|
| `phase:auto:start` | オートフェイズ開始 | { player } |
| `phase:auto:before-draw` | アクティブ化後 / ドロー前 | { player } |
| `phase:auto:after-draw` | ドロー後 / FILE前 | { player, drawn } |
| `phase:auto:after-file` | FILE置き完了 | { player } |
| `phase:main:start` | メインフェイズ開始 | { player } |
| `phase:main:end` | メインフェイズ終了 | { player } |
| `phase:end:start` | エンドフェイズ開始 | { player } |
| `phase:end:cleanup` | ターン終了効果切れ前 | { player } |
| `turn:start` | ターン開始 (オート前) | { player, turnNo } |
| `turn:end` | 完全終了直前 | { player } |

## 推理 / アクション / コンタクト

| Hook | タイミング | payload |
|------|-----------|---------|
| `reasoning:declare` | 推理宣言時 | { uid, byPlayer } |
| `reasoning:before-add` | 証拠追加直前 (LP参照) | { uid, lpUsed } |
| `reasoning:end` | 終了 (ミスリード効果切れ) | { uid } |
| `action:declare` | アクション宣言時 | { byUid, target } |
| `action:guard-window` | ガード判定窓 | { byUid, target } |
| `action:guarded` | ガード成立 | { byUid, guardUid } |
| `action:unguarded` | ガード不成立 | { byUid, target } |
| `action:end` | アクション終了時 | { byUid, result } |
| `contact:start` | コンタクト発生 (rules/22 ガードと判定の間) | { aUid, bUid } |
| `contact:order-set` | 行動順確定 | { firstUid, secondUid } |
| `contact:before-judge` | AP判定直前 | { aUid, bUid, aAP, bAP } |
| `contact:judge` | AP判定実施 | { winner, loser } |
| `contact:end` | コンタクト終了 | {} |

## 場の出入り — rules: [17](../rules/17-icons.md)

| Hook | タイミング | payload |
|------|-----------|---------|
| `enter` | 現場登場時 (登場時/疾風N判定) | { uid, viaEffect, enterOrder } |
| `disguise:into` | 変装で入替 | { uid, fromCardId, newCardId } |
| `leave:to-remove` | 現場リムーブ時 | { uid, cause } |
| `leave:to-deck` | 変装で元キャラがデッキ下へ (rules/23 リムーブ扱いではない) | { cardId } |
| `leave:to-partner-area` | MR が相手ターン中に離場→PA (rules/18) | { uid } |
| `mr:overwrite` | MR重複登場で既存MRリムーブ | { newUid, removedUid } |

## 効果・状態変化

| Hook | タイミング | payload |
|------|-----------|---------|
| `effect:declared` | 宣言能力使用時 | { uid, abilityId } |
| `effect:resolve:start` | 効果解決開始 | { effectId } |
| `effect:resolve:end` | 効果解決終了 | { effectId } |
| `state:change` | active/sleep/stun 変化 | { uid, from, to } |
| `state:tryActivate` | アクティブ化試行 (スタン特殊用 rules/03) | { uid } |
| `keyword:granted` / `keyword:revoked` | キーワード変動 | { uid, kw } |

## 証拠・FILE・デッキ

| Hook | タイミング | payload |
|------|-----------|---------|
| `evidence:gain` / `evidence:lose` | 証拠+/- | { player, n } |
| `evidence:remove-by-action` | アクション[事件]リムーブ (ヒラメキ判定窓) | { player, ev } |
| `file:add` / `file:pop` | FILE 出入り | { player, card } |
| `deck:peek` / `deck:reveal` / `deck:shuffle` | 検索系 | {...} |
| `refresh:before` / `refresh:after` | リフレッシュ前後 (相手側痕跡判定) | { player } |
| `lose:by-deck-out` | 0枚リフレッシュ敗北 | { player } |

## ターン跨ぎフラグ更新

| Hook | タイミング |
|------|-----------|
| `flag:assist:set` | アシスト実施 |
| `flag:hand-use:set` | 手札の使用 |
| `flag:next-hint:used` | ネクストヒント使用 |
| `flag:declared-use:incr` | 【ターン①/②】カウント増加 |

## HookName union (TypeScript 型定義)

```typescript
type HookName =
  | 'phase:auto:start'|'phase:auto:before-draw'|'phase:auto:after-draw'|'phase:auto:after-file'
  | 'phase:main:start'|'phase:main:end'|'phase:end:start'|'phase:end:cleanup'
  | 'turn:start'|'turn:end'
  | 'reasoning:declare'|'reasoning:before-add'|'reasoning:end'
  | 'action:declare'|'action:guard-window'|'action:guarded'|'action:unguarded'|'action:end'
  | 'contact:start'|'contact:order-set'|'contact:before-judge'|'contact:judge'|'contact:end'
  | 'enter'|'disguise:into'|'leave:to-remove'|'leave:to-deck'|'leave:to-partner-area'|'mr:overwrite'
  | 'effect:declared'|'effect:resolve:start'|'effect:resolve:end'
  | 'state:change'|'state:tryActivate'|'keyword:granted'|'keyword:revoked'
  | 'evidence:gain'|'evidence:lose'|'evidence:remove-by-action'
  | 'file:add'|'file:pop'|'deck:peek'|'deck:reveal'|'deck:shuffle'
  | 'refresh:before'|'refresh:after'|'lose:by-deck-out'
  | 'flag:assist:set'|'flag:hand-use:set'|'flag:next-hint:used'|'flag:declared-use:incr';
```

## 関連
- [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md) — `Effect` 返却型
- [engine-api-resolver.md](engine-api-resolver.md) — pendingEffects との関係
- [engine-api-types.md](engine-api-types.md)
