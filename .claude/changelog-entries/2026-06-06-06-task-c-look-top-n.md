## タスク C #3: look-top-N 解禁 — sceneEnter enterSleep (スリープ状態で登場)

**Round/Phase**: 2026-06-06 session — C 第3弾 (engine-extension-plan の look-top-N select)。

### engine 拡張 (additive)

- `sceneEnter` atom に **`enterSleep:true`** arg を追加 (atom-handlers.ts)。`mutate.scene.enter` の
  既存 `EnterOpts.active===false → 'sleep'` 経路へ橋渡し (enter/switchEnter 共通)。未指定は従来通り active。
  既存カードに enterSleep 使用 0 件 → 完全 additive (回帰 0)。

### 対応カード (1 枚, ct-d01)

- **D01012 灰原哀** (青Lv5): 【相手ターン中】【現場リムーブ時】デッキ上3枚からレベル4以下の【青】キャラを
  1枚まで **スリープ状態で登場**、残りデッキ下 (leave:to-remove selfOnly + condition turn:opp +
  deck-look-N maxN3 + sceneEnter enterSleep + deckToBottomBound)。a2 = 【ヒラメキ】キャラ1枚 sleep。
  filter は `color:'青' + levelMax:4 + kind:'character'` (BUG-123 教訓)。

### 検証

- typecheck clean / 全 vitest **1809 pass / 0 fail** (回帰0、look-top-n-enterSleep 2 case:
  [青]Lv4 を sleep 登場・青Lv5/緑Lv3 decoy 除外 / 自分ターンでは不発)。
- D01012 a1 は leave:to-remove トリガ (UI 起動が非現実的) のため engine test で網羅 (leave-batch 先例と同方針)。
- lint (eslint/side-channel/listener) errors=0。

### ALL_CARDS

937 → 938 枚 (+1)。

### C 進捗まとめ

reasoning hook (#1 selfOnly / #2 triggerCharMatches) + look-top-N (#3 enterSleep) を解禁。
残: reasoning 残 ~11 (souza/発見・optional self-remove・multi-target・reasoner-binding) /
disguise hook 13 / event→evidence 7。
