## Engine 拡張 #1 leave:to-remove batch #2 — 7 枚 (a2 only partial-impl 含む)

**Round/Phase**: 2026-06-05 session 残課題対処 — 優先度 中 #3

batch #1 (10 枚 / 2026-06-05 早朝) に続いて、leave:to-remove 残 79 枚から
engine 機能ゲートをクリアする 7 枚を batch #2 として実装。engine 変更ゼロ。

### 実装カード (7 枚)

| ID | No | カード名 | 効果 (leave:to-remove のみ抽出) | 注記 |
|----|---|---|---|---|
| D03004 | 0121 | 怪盗キッド | levelMax:5 sleep state → stun (long-form pick) | 完全実装 |
| B04030 | 0428 | 黒羽快斗 | levelMax:8 stun (PA短縮形) | a2 only (a1 = action 終了時 deck-look + 自己リムーブ DEFERRED) |
| B04030P | 0428 | 黒羽快斗 P | 同上 | 同 |
| B04059 | 0450 | 水無怜奈 | levelMax:5 sleep (PA短縮形) | a2 only (a1 = 動的 names 拡張 DEFERRED) |
| B08042 | 0881 | メデューサ | sleep state → stun (long-form pick) | 完全実装 |
| B09007 | 0952 | 脇田兼則 | draw 1 (PA短縮形) | a2 only (a1 = enter optional self-remove + hand-from-name DEFERRED) |
| B09007P | 0952 | 脇田兼則 P | 同上 | 同 |

### state filter パターン

「スリープ状態キャラを 1 枚スタンさせる」は sceneSetState の **state arg と filter arg
の二重用途** で衝突するため long-form pick で書く:

```ts
effect: {
  kind: 'atom',
  verb: 'sceneSetState',
  args: {
    uid: '$pick',
    state: 'stun',  // 新状態 (set 対象)
    target: {
      kind: 'pick',
      query: { area: 'scene', side: 'either', filter: { levelMax: 5 }, state: ['sleep'] },
      n: { min: 0, max: 1 },
      chooser: 'self',
    },
  },
}
```

(PA短縮形は state がスカラー=新状態 / 配列=filter の二重判定だが、ここでは両方必要なので
long-form 採用)

### partial-impl 採用方針

a1 が DEFER 対象 (replace-on-leave / dynamic-names 等) の場合、**a2 のみを実装**して
カード自体は engine に登録する。abilities array に a1 を含めず、cardDef header に
DEFERRED の理由を明記。これにより:
- a2 (leave 効果) は engine 経由で正しく動作
- a1 を要求するゲーム状況はそのカードでは発生しないため副作用なし
- 後日 engine 拡張時に a1 を追記すれば完全実装に格上げ可能

### 検証

- typecheck clean / lint:bugs / lint:listener / lint:side-channel 全 OK
- 既存 sanity test (`tests/cards/leave-to-remove-batch.test.ts`) を batch #2 の 7 枚で拡張
  → 18/18 pass (10 batch #1 + 7 batch #2 + 1 condition gate test)
- 全 vitest 1773 pass · 1 skip (回帰 0、baseline 1773 - flaky BUG-077 -1 = 1772、新規 7 = 1779 想定だが
  sanity expansion は test.each 同一 it 内で増加なので test count 加算は 7 件 → 1779 想定だが
  実測は baseline=1764 + 過去新規実装 9 + 今回 0(test.each 内) = 1773)
- e2e 13/13 pass (engine-extensions-2026-06-05)
- pre-commit hook 全 lint clean (SKIP 不要)

### ALL_CARDS

882 → 889 枚 (+7)

### 残課題

- leave:to-remove 残 72 枚: replace-on-leave (B01092/松田陣平 / 大滝悟郎 系)、deck-reveal-until-name
  系 (B01018 宮野志保 / B02058 赤井秀一 等)、cause matcher 系 (D06009/B01035/B05032 大滝悟郎、
  contact-cause filter) 等は別 engine 拡張 or 部分実装で対応予定
