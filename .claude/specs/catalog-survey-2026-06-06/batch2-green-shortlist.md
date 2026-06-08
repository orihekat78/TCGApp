# batch #2 green shortlist — 高信頼 engine変更0 候補 (2026-06-07)

`classification-complete.json` の green候補 266 のうち、**全句が実証済みパターンに対応**する
高信頼カードを手選別。各カードは実装時に card-addition-checklist + text-faithfulness Playwright で最終確認する。
代表 1 枚実装 → 同 signature cluster (色違い/同型) へ水平展開。

## 推奨着手順 (実証パターン別、易→難)

### A. 単純 enter + hirameki (最易、D08013/D01012 同型)
| rep | 機構 | 実証元 |
|-----|------|--------|
| B01011 | スリープ状態で登場 / 【ヒラメキ】draw | enterSleep=D01012, hirameki draw=D08013 |
| B03007 | look-4 (イベント pick→手札, 条件 discard) / 【ヒラメキ】draw | deckRevealUntil + handAddFromDeck + chain |
| B05060 | look-2 (特徴 pick→手札) | look-N select |
| PR061  | look-4 (特徴 pick→手札, 条件 discard) / 【ヒラメキ】draw | 同上 |
| PR180  | enterSleep + look-3 (特徴 pick→手札, 条件 discard) | 同上 |

### B. reanimate (リムーブ→登場/手札, sceneEnter from:remove / handAddFromRemove)
| rep | 機構 | 実証元 |
|-----|------|--------|
| D05006 | 【登場時】任意 discard → リムーブの【黄】キャラ reanimate(sleep) | chain + sceneEnter from:remove + enterSleep |
| PR042  | 【登場時】任意 discard → 少年探偵団 2枚 reanimate(sleep) | multi-pick sceneEnter (G.multi-pick) |
| PR138  | 【登場時】自sleep+discard → 黒ずくめ reanimate / 【ヒラメキ】sleep-pick | proven |
| PR155  | 【登場時】手札から灰原 enterSleep+draw / 【ヒラメキ】reanimate→手札 | sceneEnter from:hand + handAddFromRemove |
| B02053 | event: 怪盗 reanimate / 【ヒラメキ】reanimate→手札 | proven |
| D09025 | event: 長野県警 reanimate + 突撃付与 / 【ヒラメキ】draw | sceneEnter remove + charGrantKeyword |

### C. leave:to-remove フック (【現場リムーブ時】, leave:to-remove 実証済)
| rep | 機構 | 実証元 |
|-----|------|--------|
| B05034 | 【現場リムーブ時】+【ヒラメキ】: リムーブの【緑】event を手札 | handAddFromRemove filter{color,kind:event} |
| B09015 | 【現場リムーブ時】: リムーブの円谷光彦/Lv4少年探偵団 を手札 | handAddFromRemove filter |
| B07042 | 【現場リムーブ時】: リムーブの白馬探 を手札 | handAddFromRemove filter cardName |
| B03012 | 【現場リムーブ時】手札から工藤新一 登場 / 【ヒラメキ】reanimate→手札 | sceneEnter from:hand |
| D05007 | 【現場リムーブ時】look-3 → 【黄】reanimate(sleep) / 【ヒラメキ】sleep | leave hook + look-N + enterSleep |

### D. forEach 全体 + フック (B06071/B02032 同型)
| rep | 機構 | 実証元 |
|-----|------|--------|
| PR230 | 【登場時】+【現場リムーブ時】全キャラ sleep / 【ヒラメキ】sleep | forEach over:all + leave hook |

### E. enter viaEffect 条件 (enter payload.viaEffect)
| rep | 機構 | 実証元 |
|-----|------|--------|
| B06079 | 【登場時】自分の能力/効果で登場した場合 self AP+1000 + 突撃 | enter viaEffect cond + charModifyAP/GrantKeyword |

## 注意
- 上記は **代表 rep**。同 cluster の他カードは `remaining-to-classify.json` の `members[]` 参照。
- 「自分の能力や効果によって登場」(viaEffect bool) は green だが、
  「**レベルN以上/【色】/特徴 の** 〜によって登場」(source-attribute) は 🟡 (enter-source-attribute gate)。混同注意。
- multi-pick reanimate (PR042) は G.multi-pick 解禁済だが med 信頼 → 代表実装で実機確認。
