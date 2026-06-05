## Engine 拡張 #5b 残課題: charSetCard PA短縮形 + B02023 遠山和葉

**Round/Phase**: 2026-06-05 step 5b 残課題 (PA短縮形)

step 5b の残課題 (declarative pick + fromDeckTop) を解消。「キャラを 1 枚まで選び、
デッキ上端を裏向きでセット」を declarative に表現可能に。

### 変更内容

#### `charSetCard` に PA 短縮形 path 追加

```diff
case 'charSetCard': {
+ if (a.uid === undefined && a.fromDeckTop && typeof a.player === 'string' && hasNorMax(a)) {
+   // PA短縮形: uid pick + fromDeckTop
+   const paTarget = buildShortFormPick('scene', a, scsP, scsP);
+   tryRePickFromAtom(s, { kind:'atom', verb, args:{...a, uid:'$pick', target:paTarget} }, ...);
+   return;
+ }
+ if (a.uid === '$pick') { /* skip-unresolved */ return; }
  // 既存 path (確定 uid)
}
```

#### `atom-pick-spec.ts` に登録

```diff
+ charSetCard: { defaultArea: 'scene', mode: 'PA' },
```

### 実装カード

| ID | No | カード名 | 効果 |
|----|---|---|---|
| B02023 | 0193 | 遠山和葉 | 【登場時】自陣キャラを1枚pick → デッキ上端を裏向きでセット (a2 cost=set-card除去 は DEFER) |

### 検証

- typecheck clean
- 全 vitest 1763 pass · 1 skip (回帰 0、baseline 1764 から flaky BUG-077 のみ差分 = 1 件減)
- e2e (engine-extensions-2026-06-05) 8/8 pass:
  B02023 handUseCard → enter a1 → pendingEffectPick(charSetCard) → tgt#1 を resolve →
  tgt#1 の setCards に { D08013, faceUp:false }、deck から D08013 splice を実機検証
- ALL_CARDS 877 枚 (+1)

### 残課題 (次セッション以降)

- B02020/B02030 等の opp 側 / 自陣 declared 版 (PA短縮形で実装可能、batch #2 で対応)
- replace-on-leave (B08054 a1 等) — engine の `replace` kind 配線が必要
- 「セットされるたび」hook (B02018 a1) — card-triggerable hook 未対応
- B02023 a2 — cost=set-card 1リム は cost system 拡張要
