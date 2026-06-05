## Engine 拡張 #4 sceneToHand batch #2 — 5 枚 (engine 変更 0)

**Round/Phase**: 2026-06-05 session 残課題対処 — 優先度 中 #4

batch #1 (B06069/P 2 枚 / 2026-06-05 早朝) に続いて、sceneToHand 残 25 枚から
engine 機能ゲートをクリアする 5 枚を batch #2 として実装。

### 実装カード (5 枚)

| ID | No | カード名 | 効果 | 注記 |
|----|---|---|---|---|
| D09014 | 0505 | 大和敢助 | 【FILE7】enter sleep / 【パートナー黄】declared sleep cost → 相手 lv≤5 sleep状態 bounce | 完全実装 (a1 + a2) |
| D09015 | 0505 | 大和敢助 (別 variant) | 同上 | 同 |
| B06076 | 0696 | ジェイムズ・ブラック | 【解決編】enter → 相手 lv≤5 bounce | a1 only (a2 = custom 「相手手札≥4」condition DEFERRED) |
| PR135 | 0620 | 灰原哀 (PR) | enter + 自陣 lv6+ 阿笠博士 → 相手 lv≤8 bounce | a1 only (a2 = deckRevealUntil-name + handAddFromDeck、別バッチで対応予定) |
| PR141 | 0620 | 灰原哀 (PR variant) | 同上 | 同 |

### 新パターンの確立

**condition `fileAtLeast`** + enter trigger:
```ts
condition: { kind: 'fileAtLeast', n: 7 }, // 【FILE7】
trigger: { hook: 'enter', selfOnly: true },
```

**state filter long-form bounce** (sleep filter + bounce):
```ts
verb: 'sceneToHand',
args: {
  uid: '$pick',
  target: {
    kind: 'pick',
    query: { area: 'scene', side: 'opp', filter: { levelMax: 5 }, state: ['sleep'] },
    n: { min: 0, max: 1 },
    chooser: 'self',
  },
},
```

**condition `sceneHas` with cardName + levelMin**:
```ts
condition: {
  kind: 'sceneHas',
  query: { area: 'scene', side: 'self', filter: { cardName: '阿笠博士', levelMin: 6 } },
  nMin: 1,
},
```

### 検証

- typecheck clean / lint:bugs/listener/side-channel 全 OK
- 全 vitest 1774 pass · 1 skip (回帰 0、flaky BUG-077 はこの run で pass、baseline 1773 + 新規 0 unit
  ※ batch #2 は sanity test 拡張ナシ、e2e カバー)
- e2e 13/13 pass (engine-extensions-2026-06-05)
- pre-commit hook 全 lint clean (SKIP 不要)

### ALL_CARDS

889 → 894 枚 (+5)

### 残課題 (bounce 残 20 枚)

- B01047/P 黒羽快斗 (action 終了時 self-deck-bottom + grant turn-end-bounce) — DEFER (replace-on-leave 系)
- B01067 メアリー (action[事件]→evidence 時 bounce) — action[事件] evidence-gain hook 必要
- B01092/P 松田陣平 (相手効果で離れる時 self-remove → bounce 代替) — replace-on-leave 系 DEFER
- B03070/P メアリー (action[事件]→evidence 時 + sleepSelf option + bounce + opp discard) — 同 hook 必要
- B06007/P 灰原哀 (パートナー青 + enter + 3択 choice) — choice effect は B07101 で先例あり、別バッチで対応可能
- B07008 小嶋元太 (FILE5 enter + optional sleepSelf + bounce) — optional self-sleep
- B08081/P 広田雅美 (解決編 enter + optional discard + bounce / 別 ability で 相手効果無効化) — DEFER
- B08054 widow a1 (replace-on-leave) — DEFER
- B08014/P 毛利蘭 (action 後 turn-end self-bounce 効果付与) — 複雑
