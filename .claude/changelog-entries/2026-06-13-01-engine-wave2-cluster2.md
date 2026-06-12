# engine拡張 wave#2 cluster2 — ability-presence filter + 骨格バグ2件修正 + 解禁10枚 (ALL_CARDS +10)

**Round/Phase**: 2026-06-12〜13 engine拡張 wave#2 cluster2 (`engine/wave2-ability-filter`)。
骨格凍結例外 (user 承認済 engine拡張 + 骨格自体のバグ修正 BUG-137/138)。
設計は Workflow 調査 7 lens (92万tok) → 敵対設計レビュー 3 lens (fable×2+opus、approve-with-fixes、
fatal 0、major 9 全反映) で v2 確定 ([engine-wave2-ability-filter-design.md](../specs/engine-wave2-ability-filter-design.md))。
一次根拠: TSV qAndA 8件 — **「〜を持つ」= 印字 (静的) 判定、条件アイコンの有効性は問わない** (rules/17 に裁定追記)。

### X1/X1b: ability-presence filter (現場リムーブ時 / 疾風 / カットイン)

- `ICON_KEYWORD_PREDICATES` に `現場リムーブ時` (= trigger.hook(s) 'leave:to-remove' + selfOnly) と
  `疾風` (= 'enter' + selfOnly + matcherCondition enterOrderEquals) を追加 — 既存 `filter.keyword`
  経路 (BUG-122 配線) が scene/hand/remove/deck pick・cost・sceneHas で**無変更連動**。
  新 filter キー/型/whitelist 変更ゼロ
- filter silent-drop (BUG-117/118 同型ドリフト) を **2 サイト解消**: `targetFilterToPredicate`
  (deck 窓) に keyword/cardName、`boundMatchesFilter` (第3サイト、水平展開発見) に keyword/kind/ap/lp
- `FILTER_FIELDS` の sync テスト新設 (`Record<Exclude<keyof TargetFilter,'custom'>, true>` satisfies 方式
  — 従来は同期テスト対象外で更新漏れを CI が検知できなかった)

### X6/X7: boundToRemove 新 verb + mill refresh guard (BUG-137)

- `boundToRemove {player, bindKey}`: deck-look 窓の残りをリムーブエリアへ (B09073 a2「残りをリムーブ
  エリアに移す」)。BUG-132 splice 防御移植 + **移送完了後 deck0 で refresh** (B09073 qAndA)
- **BUG-137**: `mill` が deck 枯渇時に refresh を呼ばない既存骨格バグを修正 (B09104 qAndA
  「可能な限りリムーブ→その後リフレッシュ」/ rules/14・26。出荷済 mill 13枚に有効、smoke デッキ使用 0 で baseline 不変)

### X8: pick 所有権 (BUG-138 — human pick 横取りの構造解消)

- CPU ターン中の `drainAiEffectPicks` が human 所有 pending を heuristic で勝手に確定していた既存バグ。
  `__humanPlayerSide` 所有分を温存 + `playTurn` が `paused:{humanPick}` で停止 (rules/05・15) +
  `useOppTurnDriver` が surface → modal 解決後に再開。smoke/観戦は humanSide=null で **byte-equal**
- human modal 代行テスト用に `_drainAllEffectPicksForTest` 新設 (既存テスト 3 箇所を移行)

### 解禁カード 10枚 (certify = 設計レビュー clause 突合 + 敵対 verify)

B03131 / B03128 / B08005 / B08005P / B08016 / B08094 / B08094P (case) / B09104 / B09073 / B09073P
(ALL_CARDS 1130→1140)。DEFER 8枚は [DEFERRED-INDEX.md](../specs/DEFERRED-INDEX.md) に理由付き記録
(B08078/P=他カード hook 外部発火、B08082/B03133/B06020/B07098/P/B07102 — B06020 は triage 誤分類を訂正)。

### 検証で発見・修正した追加バグ 2 件

- **BUG-139**: 必須 pick 未解決のままターン終了でき必須効果が黙って永久放置 (X8 が stall として
  顕在化 → MCP 実測で RCA)。endTurn dispatch に narrow gate (nMin>=1 の self pick) + e2e robot が
  prompt を解決するよう修正。useOppTurnDriver は pick/choice/optional 解決を deps に追加して再開配線
- **BUG-140 (起票・B04096/P のみ補修)**: 出荷済 76 枚で TSV cutIn/hirameki 列が def から欠落
  (機械監査 `scripts/audit-icon-abilities.mts` 新設、cutin 13 + hirameki 63)。B03128 の
  live decoy だった B04096/P のみ本クラスタで補修、残 74 枚は専用 wave へ defer

### 検証

- TDD pin 36本 (X1〜X8 + FILTER_FIELDS sync + batch 11) / full vitest 2016 pass / tsc clean /
  validate-specs 70 pass 0 fail / **smoke baseline 完全一致** (469/531, avg 10.86, exc 0) /
  **e2e 119 passed** (full-match は BUG-139 修正で従来の黙殺より正しい挙動で完走) /
  MCP 実機 decoy 3 シナリオ (B09104: 条件アイコン付き含む・自身除外・相手現場含む / B03128: 窓 hold +
  黒カットインイベントのみ match・色 decoy 素通り・0枚可ボタン / X8: pause→modal 実表示→UI 解決→CPU 再開)、
  console error 0
- 水平展開: capability-map.txt:577 stale 訂正 / rules/17 裁定追記 / DEFERRED-INDEX 100行制限分割
  (2026-05 スナップショットを DEFERRED-ARCHIVE-2026-05.md へ)
