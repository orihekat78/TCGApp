# engine拡張 wave#2 cluster14 — multi-card sceneEnter (2枚まで登場) 4枚解禁

**Round/Phase**: 2026-06-15 engine拡張 wave#2 cluster14 (`engine/wave2-cluster14-multi-sceneenter`)。
triage (残 needs-design gate を opus per-card certify で再評価) で **最良 risk-adjusted** (4枚/L/med/GameState 非改変/win条件非介入)
と実証された multi-card sceneEnter gate を出荷。「…キャラを2枚まで選び、登場させる」型を engine に追加。
**実装前** に opus 3-lens 敵対設計レビューを通し、3 blocker (0枚 decline で FILE リムーブ drop / `__declined` 未処理 /
scene-full クラッシュ) + 7 required fix を設計に織り込んでから着手。

### engine 変更 (骨格凍結原則 例外 = rules/20 スイッチ + defer カード根拠 / 新 verb・cond・cost・hook 無し)

- **atom-handlers.ts** `sceneEnter`: case 冒頭 (早期 scene-full-skip より前) に `cardIds:'$pick.cardIds'` 契約を additive 追加
  (handAddFromRemove/charStackCard と同型)。0..2 枚を per-card splice→enter/switchEnter。`switchRemoveUids[]` を per-card に消費。
  現場満杯時は victim の現 scene 存在を検証 (stale uid で enter throw 防止)、`full` をループ内で都度再計算。
  per-card `event.emit('enter')` で enterOrderThisTurn を1枚ずつ加算 (疾風N 正)。`__declined` 再入で 0 体登場 (continuation は別途実行)。
  単一 cardId path は cardIds 不在時 byte 不変。
- **apply-pick.ts**: `applyPickAndContinuation` に第6引数 `switchRemoveUids?:string[]` (switchPart は plural→singular→{} 順で単一 path 不変)。
  `chooseAiPick` の multi-pick に **distinctNames dedup** (UI `isDistinctNamesBlocked` と同義 = `allCardNameComponentsForDef` で
  既選択 component 衝突 skip、rules/19 split-name)。`drainAiEffectPicks` の 0-pick で `skipResolvesAtom` 時 `applyPickSkipAndContinuation`
  (human path と対称、B09010 の 0枚でも後続 FILE リムーブ実行)。
- **resolve-picks.ts**: `pushPendingEffectPickSide` で atom の `skipResolvesAtom` を pending に透過 (deckRevealUntil と同契約を generic 化)。
- **useEngineDispatch.ts** (UI): `effectPickResolve` union に第5メンバー `{pickedUid,pickedUids,switchRemoveUids}` (plural のみ・単数キー無=既存 discrimination 不変) + 6th arg thread。
- **Playmat.tsx** (UI): `onPickMulti` を `pend.atomVerb==='sceneEnter'` のみで分岐し、overflow (登場枚数−room) ぶん SceneSwitchPickerModal を
  loop して victim 収集 → `switchRemoveUids` 付き dispatch (cancel=全辞退)。既選択 victim は除外。banner を nMax 反映に。charStackCard 経路 byte 不変。

### 解禁カード 4 printings (ALL_CARDS 1207→1211)

- **B09010 / B09010P 阿笠博士** (青Lv7): 【FILE6】【宣言】【スリープ】→ remove の **レベル4(EXACT)・カード名相異** [少年探偵団]
  を2枚まで登場(active) + FILE上1枚リムーブ。`skipResolvesAtom:true` で 0枚でも FILE リムーブを解決 (公式Q&A)。
- **PR042 / PR046 鈴木園子** (白Lv7): 【パートナー青】【登場時】手札1枚リムーブしてもよい→そうした場合 remove の
  **レベル4以下** [少年探偵団] を2枚まで **スリープ状態で**登場 (chain + enterSleep)。

### gate (全 green)

- tsc 0 / **vitest 2226 pass** (+12 cluster14-multi-sceneenter.test.ts: 2枚 active/enterSleep/room1+1switch/full+2switch/
  full-no-victim crash 無/distinctNames dedup/0枚 decline で FILE リムーブ/exact-vs-≤ level/疾風N per-card/阿笠 self victim/構造)。
- **smoke winsA=498 不動** (avg 11.00) = 単一 sceneEnter path + deckRevealUntil AI drain ともに byte-equal の証跡。
- playwright 回帰 119 pass (charStackCard / 単一 reanimate 不変) + **MCP 実機検証** (B09010 宣言→CardListModal 2枚 (distinctNames 候補)→
  onPickMulti overflow→SceneSwitchPickerModal「登場2枚 退場1/1」→2体 active 登場 + 灰原哀 switch 離場 (【現場リムーブ時】発火) + FILE−1、
  JS/engine エラー 0)。
- 設計レビュー: opus 3-lens (rules/correctness BLOCK→fix / engine統合 GO-with-fixes / AI-UI GO-with-fixes) = synthesis GO-with-fixes、全 fix 反映。
