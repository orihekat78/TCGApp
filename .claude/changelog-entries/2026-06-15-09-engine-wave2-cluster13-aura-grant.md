# engine拡張 wave#2 cluster13 — aura-grant (他キャラへの AP buff) 11枚解禁

**Round/Phase**: 2026-06-15 engine拡張 wave#2 cluster13 (`engine/wave2-cluster13-aura-grant`)。
triage で ready-now と実証された aura-grant gate を出荷。「【自分ターン中】自分の現場にいる [filter] のキャラを
AP＋1000する」型の **他キャラ buff aura** を engine に追加 (従来 continuousModifier は OWNER-SELF 専用だった)。
実装後 opus 3-lens 敵対設計レビュー (再帰/correctness・no-op/perf・rules/encoding) で red-team。

### engine 変更 (骨格凍結原則 例外 = 常時有効型 aura の additive 拡張 / 新 verb・cond・hook 無し)

- **card-def.ts**: `ContinuousModifier` に `apDeltaAura?:number / lpDeltaAura?:number / auraFilter?:TargetFilter / auraExcludeSelf?:boolean` を additive 追加。
- **read/char.ts**: 新 `auraDelta(s, targetUid, which)` = **board-scan reader** (cluster5 `restrictsOpponent` を数値 aura へ拡張)。
  target の **同一 side 現場**の各 bearer につき、`ability.type==='continuous'` + `apDeltaAura` 宣言 + `condition` (【自分ターン中】等) 成立 +
  `auraExcludeSelf` 時 bearer≠target + `auraFilter` が target に一致 (`matchOneFilter`=有効値レベル/色/特徴) を満たせば加算。
  `ap()/lp()` に `auraDeltaSafe` を合算し register。
- **candidates.ts**: `registerAuraDelta` + `auraDeltaSafe` (continuousDelta と同じ late-binding + 再帰 guard `_inAuraDelta`)。
  `matchOneFilter` の ap/lp 算出にも `auraDeltaSafe` を加算 = **第5合算サイト** (filter-AP と combat-AP を一致させる、BUG-117 原則)。
- **再帰安全性**: `auraDelta`→`matchOneFilter`→`auraDeltaSafe` は `_inAuraDelta` で 0 化 (auraFilter の AP 判定が aura を二重計上しない)。
  `_inContinuousDelta` 中も 0 (BUG-113 cycle と同 posture)。既存カードは aura 未宣言 → `auraDelta`=0 = **完全 no-op** (smoke baseline 不変)。

### 解禁カード 11 printings (ALL_CARDS 1196→1207)

- **単純 color/trait aura + ヒラメキ draw (excludeSelf)**: D05005 黒田兵衛(黄)・D07010/D07011 ラム(黒)・B01038/B01038P 服部平蔵(緑)・
  B03075 ジェイムズ・ブラック(赤)・B07044 ジョディ・ホッパー(マジシャン trait)。
- **B02012 毛利小五郎** (青): a1 aura {青 levelMax5, include-self} + a2「【ターン1】妃英理/毛利探偵事務所 がアクション時1ドロー」(action:declare + or[cardName,trait])。
- **B09009 赤木守** (青): a1 aura {サッカー選手 trait, include-self} + a2 ヒラメキ handAddFromRemove (リムーブの サッカー選手 を1枚まで手札)。
- **PR274/PR275 工藤新一** (青): a1 conditional aura {事件が【青】以外の色を持つ場合 (caseColor OR), このキャラ以外 全キャラ} + a2「【宣言】【スリープ】レベル9以下を1枚まで リムーブ」。

### gate (全 green)

- tsc 0 / **vitest 2214 pass** (+9 cluster13-aura-grant.test.ts: aura+1000/非一致不変/excludeSelf/include-self/turn-gate/
  **filter-AP==combat-AP (matchOneFilter が aura 込み AP を見る)**/B02012 有効値レベル/PR274 case-color)。
- **smoke:1000 baseline 不動** (winsA=498 完全一致 / 0 例外 = aura 未宣言カードへの no-op + hot-path 性能影響なしを実証)。
- playwright 119 pass (candidates/read AP 経路の UI 回帰なし) / CI lint errors0 / icon shipped1207。
- **opus 3-lens 敵対設計レビュー** (再帰/correctness・no-op/perf・rules/encoding) = **GO / 0 blocker・0 major**。
  recursion-crash risk と card mis-encoding risk を source 精査 + gate 再走で affirmative にクリア。残 nit は 2件とも非出荷影響:
  (1) 将来 auraFilter が apMin/apMax 等を使う場合の self-参照 (現出荷は color/trait/level のみ=該当なし、DEFERRED-INDEX に文書化)、
  (2) aura 不在盤面でも matchOneFilter 毎に board-scan (O(現場≤5)・~0.19μs・smoke timing 不変=測定可能な regression なし)。

### 既知制約 (DEFERRED-INDEX cluster13 §)

- aura は **同一 side** のみ buff (両 side aura は本クラスタ範囲外、現出荷カードは全て自陣 buff)。
- triggered 能力テキストの付与 aura (B09024「他キャラに【現場リムーブ時】を与える」) は **別 gate** (非キーワード能力テキスト付与) = 継続 DEFER。
