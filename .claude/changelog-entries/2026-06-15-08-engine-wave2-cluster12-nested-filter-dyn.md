# engine拡張 wave#2 cluster12 — nested-filter-dyn (FILEエリア枚数以下レベルの登場) 15枚解禁

**Round/Phase**: 2026-06-15 engine拡張 wave#2 cluster12 (`engine/wave2-cluster12-nested-filter-dyn`)。
triage workflow (6 gate を opus per-card certify→敵対 refute→synthesize) で **真に ready-now な gate** を実証選定し、
最有力の `nested-filter-dyn` を出荷。「自分のFILEエリアの枚数以下のレベルの…キャラを登場」系イベント (`levelMax:{dyn:'$self.fileCount'}`)
を pick filter で解決できるようにする additive engine 変更 + 15 printings。実装後 opus 3-lens 敵対設計レビューで red-team。

### engine 変更 (骨格凍結原則 例外 = 動的値解決の additive 拡張 / 新 verb・cond・hook 無し)

- **根因 (latent gap)**: `resolve-picks.ts resolveDynArgs` は **top-level 引数のみ** `{dyn}` 解決していたため、
  pick query の `filter.levelMax:{dyn:'$self.fileCount'}` のような **ネストした** `{dyn}` が未解決のまま
  `candidates.matchOneFilter` (`candidates.ts:296` の `level > filter.levelMax`) に渡り、`number > object` = 常に false
  → 「レベル上限」が黙って消える (誤挙動、throw ではない)。`buildShortFormPick` が `query.filter = a.filter` を
  frozen card-def への **参照** で代入する点も伏線。現出荷カードに該当 filter は 0 枚のため live 影響は無く、未顕在の gap。
- **修正**: `substituteAtomPick` の `targetCandidates` 呼出 **直前** で、新ヘルパー `resolveTargetFilterDyn` が
  `target.query.filter` 内の `{dyn}` 数値フィールドを `evalDyn` で具体値へ解決する (列挙 chokepoint = 全 pick 経路が収束:
  initial-walk / runtime `tryRePickFromAtom` (sceneEnter 短縮形) / human / AI `chooseAtomTarget`)。
- **2 つの設計判断 (敵対 refute 由来)**: (1) 共有 `TargetFilter.levelMax` 型は **widen しない** (number|{dyn} 化は
  `cond/eval.ts:274`・`atom-handlers.ts:90`・`candidates.ts:296` の 3 比較箇所を TS2365 で破壊する)。chokepoint で number 化すれば
  candidates は number のまま受ける。(2) frozen def を破壊しないよう filter を **clone** してから解決 (in-place mutation 禁止)。
  dyn 不在の filter は target を **同一参照**で返すため既存カードは完全 no-op (smoke baseline 不変)。
- `$self.fileCount` dyn 自体は Task D E3 (2026-06-12) で「FILEエリアの枚数以下のレベル」系の布石として実装済
  (`dyn/eval.ts:297` / アシストパートナー込み rules/17 §FILE(X))。capability-map L430「no FILE size placeholder」は stale。

### 解禁カード 15 printings (ALL_CARDS 1181→1196)

- **「小さくなった名探偵」family 13 printings** (5色+黒、`D01014/B04013` 青・`D02014/B04026` 緑・`D03014/B04040` 白・
  `D04014/B04061` 赤・`D05014/B04083` 黄・`D07023/B03132/B03132P` 黒):
  デッキ上3枚を見て【X】キャラを1枚まで手札へ (`deckRevealUntil{chooseMatch:upTo, maxN:3}`) → 残りをデッキ下 →
  手札から **FILE枚数以下レベル** の【X】キャラを1枚まで登場 (`sceneEnter{from:hand, filter:{color:X, kind:character, levelMax:{dyn:'$self.fileCount'}}}`, viaEffect)。
- **「託されたカセットテープ」B08060/B08060P 2 printings** (0898 赤): デッキ上から **レベル7が出るまで** 1枚ずつ公開し
  必ず手札へ (`deckRevealUntil{filter:{levelMin:7,levelMax:7}}` mandatory add、公式Q&A) → 残りデッキ下+シャッフル →
  加えた場合 手札1枚 discard → FILE枚数以下レベルのキャラ (色指定なし) を1枚まで登場。+【ヒラメキ】1ドロー。

### gate (全 green)

- tsc 0 (型 **非** widen を証明) / **vitest 2205 pass** (+8 `cluster12-nested-filter-dyn.test.ts`: cap 発火/境界 inclusive/
  動的 fileCount/色 filter/B08060 色フリー+reveal-until/必須 add+条件 discard)。
- **smoke:1000 baseline 不動** (winsA=498 完全一致 / avg 11.00→10.998 / 0 例外 = plain-number filter は no-op を実証)。
- playwright 119 pass (pick 経路の UI 回帰なし) / validate-specs pass=73 fail=0 (whitelist 変更なし) / CI lint errors=0 / lint:icon shipped=1196。
- **opus 3-lens 敵対設計レビュー** (correctness / no-op-safety / rules-semantics) = **GO / 0 blocker**。
  指摘の latent gap (`query.filterAny[]` 内の {dyn} 未解決) を同 commit で hardening (`resolveFilterDynObj` を抽出し
  filter / filterAny 両形に適用、現出荷カードは filterAny+{dyn} 0件のため挙動不変・smoke 再確認 winsA=498 不動)。

### 既知制約 (DEFERRED-INDEX cluster12 §)

- sceneEnter dispatch 後の atom args.filter には未解決 {dyn} が残るが、登場は確定 cardId で実行され再 filter しないため inert。
- deck-look の reveal predicate (`targetFilterToPredicate`) は本 family では color/kind のみ参照 (levelMax dyn は sceneEnter 側のみ) のため非該当。
