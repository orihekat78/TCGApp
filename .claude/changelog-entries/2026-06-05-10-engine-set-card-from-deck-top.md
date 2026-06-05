## Engine 拡張 #5b: charSetCard fromDeckTop + B08054 広田正巳

**Round/Phase**: 2026-06-05 engine-extension-plan.md step 5 (後半 = set-card)

「自分のデッキのカードを上から1枚裏向きでセットする」(B02018/B02020/B02023/B02030/B08054 等)
パターンを最小限の additive 変更で解禁。

### 変更内容

#### `charSetCard` に `fromDeckTop: true` オプション追加 (additive)

```diff
+ if (a.fromDeckTop) {
+   const sscP = resolvePlayer(a.player ?? 'self', ctx);
+   const sscDeck = s.players[sscP].deck;
+   if (sscDeck.length === 0) { /* silent no-op */ return; }
+   scCardId = sscDeck.shift()!;
+ } else {
    scCardId = resolveBindRef(a.cardId, ctx) as string;
    if (typeof scCardId !== 'string' || scCardId.startsWith('$')) return;
+ }
  mutate.char.setCard(s, scUid, scCardId, a.faceUp as boolean);
```

#### Note: set-card 機構自体は既存

- `SceneCharacter.setCards: SetCardEntry[]` は Phase 4 から存在
- `mutate.char.setCard(s, uid, cardId, faceUp)` は実装済
- 離場時の setCards リムーブ (rules/16) は `removeToRemove` / 直近追加の `toHand` で対応済
- 不足していたのは **「デッキから splice しつつ setCards に積む」path** のみ

### 実装カード batch #1

| ID | No | カード名 | 効果 |
|----|---|---|---|
| B08054 | 0892 | 広田正巳 | 【宣言】【スリープ】：自分のデッキ上端を裏向きで $self にセット (a1 leave-replace は DEFER) |

### 互換性 (回帰 0 の根拠)

- `fromDeckTop` 未指定の `charSetCard` 呼出は従来通り (cardId 明示) 動作
- typecheck clean / 全 vitest 1764 pass · 1 skip (回帰 0、baseline 1761 + 新規 3)
- 既存 setCards 周りの mutator (setCard / removeAllSetAndStacked) は変更なし

### 検証

- 新規 unit (atom-handlers.test.ts +3): fromDeckTop self.deck splice / 空デッキ no-op / リムーブ時 setCards→remove 回帰
- 新規 e2e (engine-extensions-2026-06-05.spec.ts +1) — 計 7/7 pass
  - B08054 a2 dispatch → デッキ上端 D08013 が消費 → B08054 の setCards に
    `{ cardId:'D08013', faceUp:false }` が積まれることを実機検証
- ALL_CARDS 876 枚 (+1)

### DEFER 事項

- **B08054 a1**: 「リムーブされる代わりに setCards を手札に移す」replace 効果 — engine の
  `replace` kind は未配線。set-card 機構の応用先として将来検討
- **set-card PA短縮形**: 「キャラを 1 枚まで選び、デッキ上端を裏向きでセット」(B02020/B02023/B02030)
  には PA pick + fromDeckTop の組合せが必要。次バッチで対応予定
- **B02018 a1**: 「セットされるたび」(`set:on` hook) は engine の card-triggerable hook 未対応
