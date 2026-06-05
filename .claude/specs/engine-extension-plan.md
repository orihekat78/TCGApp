# Engine 拡張計画 (骨格凍結 解除 — 2026-06-05 user 承認 / 次セッション着手)

user が「①エンジン拡張」を選択し **骨格凍結原則を解除**（CLAUDE.md 凍結原則より user 指示優先）。
残カードの大半は engine 未対応機能が原因のため、解禁効果が大きく回帰リスクが低い機能から **1つずつ** 追加する。
各機能ごとに: 設計 → additive 実装 → 全 vitest+e2e で回帰0確認 → 対応カード実装 → Playwright 検証。

## 残カードが必要とする未対応機能（解禁数=該当カード数 / 残727 / 2026-06-05集計）
| 機能 | 解禁数 | 回帰リスク | 備考 |
|------|-------|-----------|------|
| **leave/現場リムーブ時 hook** | 117 | 低(additive) | `leave:to-remove` は internal で発火済 → TRIGGERED_HOOKS 追加+listener 配線。既存カード未使用＝加算的。**推奨 first** |
| char→hand bounce (手札に戻す) | 96 | 中 | scene→hand 移動 verb 追加 |
| deck-reorder (好きな順でデッキ下) | 74 | 中 | 任意複数→デッキ下 (bind外の一般移動) |
| set-card (セット, rules/16) | 64 | 中-高 | セット機構 + 離場連動リムーブ |
| multi-target pick (N枚各々) | 23 | 中 | apply-pick Pattern A を pickedUids ループ化 (uid系 atom を各々適用) |
| level-modify (レベル±N) | 17 | 低-中 | charModifyLevel verb + level read path |
| reasoning hook (推理反応) | 15 | 中 | 推理イベントを card-triggerable に |
| disguise hook (変装時) | 13 | 中 | 変装トリガ配線 |
| continuous aura (他キャラ継続buff) | 13 | **高** | AP/LP read が他カードの aura を走査 → 全856枚に波及 |
| partner ability rewrite | 10 | 高 | パートナー能力上書き機構 |
| event→evidence | 7 | 中 | remove/hand→evidence verb (+ イベント自身の routing) |
| untargetable (選ばれない) | 6 | **高** | 全ターゲット/候補処理に波及 |
| look-top-N select | 1 | 中 | 覗き見選択 verb + UI |

## 推奨実装順（高unlock × 低リスク優先）
1. **leave/現場リムーブ時 hook**（117枚・additive・低リスク）← ✅ 実装済 2026-06-05。
   ⚠ 計画の「internal で発火済」は誤り→ `leave:to-remove` は未 emit だった。removeToRemove
   choke で emit 新設 (misplay-overflow 除外) + virtual handler。回帰0。詳細: changelog 2026-06-05-03
   - **対応カード batch #1**: 10枚 (D03013/D04010/B03013/B03091/B03130/B04010/B06009/B08084/B08089/PR054)。
     残 79枚は engine 機能ゲート (charSetLP / aura / untargetable / enter optional self-remove etc.) に
     blocked。step 2 以降で順次解禁予定。詳細: changelog 2026-06-05-04
2. level-modify（17・低-中）— 小さく安全に手順確認 ← ✅ engine 実装済 2026-06-05。
   `charModifyLevel` verb (PA 短縮形 / 3 scope 合算) を additive 追加。read.char.level と
   target/candidates.levelMin/Max を effective-value 化 (AP/LP と対称)。回帰 0。
   詳細: changelog 2026-06-05-05。対応カード 17 枚は次セッションで実装予定。
3. multi-target pick（23・中）← ✅ engine 実装済 2026-06-05。
   apply-pick.ts Pattern A を pickedUids 配列対応に拡張 (sequence wrap で per-char 適用)。
   B02021 沖田総司 (相手5枚AP-1000) を batch #1 として実装。回帰 0。
   詳細: changelog 2026-06-05-07。残 22 枚は次セッションで順次実装予定。
4. char→hand bounce（96・中）— unlock 大 ← ✅ engine 実装済 2026-06-05。
   `sceneToHand` verb (PA 短縮形 / 所有者手札へ / leave:to-remove 不発動) を additive 追加。
   B06069/P 鈴木園子 (相手レベル7以下を 1枚 bounce) を batch #1 として実装。回帰 0。
   詳細: changelog 2026-06-05-08。残 25 枚は次セッションで順次実装予定。
5a. deck-reorder (deck-look-N) ← ✅ engine 実装済 2026-06-05。
   `deckRevealUntil` に `maxN` オプション追加 (公式 "上から N 枚見る" semantics) +
   `handAddFromDeck` verb 新設。D01013 灰原哀 (上から4枚見て【青】1枚) を batch #1 として実装。
   詳細: changelog 2026-06-05-09。残 6 枚 (D02011/D03009/D04011/D05012/D07019 等同型色違い) は次バッチ。
5b. set-card（64）— 未着手。次セッション以降で実装予定。
6. 高リスク（aura / untargetable / partner-rewrite）は最後、慎重に

## 安全手順（各機能共通）
- baseline 確認: 全 vitest green（現 1720 pass / 1 skip）
- engine 変更は **additive**（既存挙動を一切変えない）を厳守
- 変更後: `tsc` + 全 vitest + `tests/e2e/reuse-cards-2026-06-05.spec.ts` で回帰0 → 対応カード実装 → Playwright(__game seam)

## engine 外の別件
- event に「特徴」がデータに無い（0678 類, 全イベント traits:[]）→ cards-data 再抽出 or tsv-loader 修正（engine外）
- partner-area の特定カード（ビッグジュエル, B07045）→ GameState 構造 + UI（大規模）

## 関連
- ゲート/検証済パターン一覧: [card-impl-engine-gates.md](card-impl-engine-gates.md)
- 実装記録: [.claude/sessions/2026-06-05-pattern1-event-react.md](../sessions/2026-06-05-pattern1-event-react.md)
