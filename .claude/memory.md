# 作業ログ — 名探偵コナンTCG プロジェクト

## 2026-06-05 (続き) — Engine 拡張 #1 batch #1 (leave:to-remove 実カード 10 枚)

Engine 拡張 step 1 で解禁した `leave:to-remove` hook を最初に使う 10 枚を `_reuse` に追加。

### 実装カード (全 _reuse 経由で ALL_CARDS 拡張)

- D03013 鈴木次郎吉 (leave:draw1 + 【ヒラメキ】sleep)
- D04010 ジョディ・スターリング (leave:opp-discard1 + 【ヒラメキ】sleep)
- B03013 大尉 (leave:charModifyAP-2000 turn)
- B03091 高木長介 (leave:side-self+trait-警察 AP+1000 turn)
- B03130 マッドサイエンティスト (leave:draw1 + 【ヒラメキ】draw)
- B04010 本堂瑛祐 (leave:level≤4 sleep)
- B06009 トラカゲ (leave:draw1→discard1 chain + 条件付ヒラメキ)
- B08084 ウォッカ (leave:draw1→discard1 chain)
- B08089 ヘルエンジェル (leave:draw1→caseStatus:解決編 conditional discard1)
- PR054 灰原哀 (enter:draw1 + leave:self-discard1)

### 共通実装パターン

- `trigger: { hook: 'leave:to-remove', selfOnly: true }`
- `condition: { kind: 'turn', player: 'opp' }` (【相手ターン中】)
- `scope: 'on-scene'` (handleLeaveToRemoveSelf が virtual `area:'scene'` で発火する)
- 【ヒラメキ】effect は `kind:'choice' + chooser:'self' + options[atom uid:'$pick' target:pick]` 形式
  (D11009 a3 同型, fire 時 hiramekiResolve が chooseAtomTarget で auto-pick するため明示形を保持)

### 検証

- typecheck clean
- 新規 unit (`tests/cards/leave-to-remove-batch.test.ts`) 11/11 pass
- 全 vitest 1736 pass / 1 skip (baseline 1725 + 新規 11 = 1736)
- `tests/e2e/reuse-cards-2026-06-05.spec.ts` e2e 9/9 pass
- npm run docs (自動生成 65 ファイル regen)、docs:check clean
- lint:listener errors=0 / lint:card-addition pass
- ALL_CARDS 計 869 枚 (+10)

### 残 leave:to-remove カード = 79 枚

engine 機能ゲート blocker:
- charSetLP / aura / untargetable / partner-area カード参照 / イベント特徴
- enter optional self-remove (B09007/PR 等)
- deckRevealUntil with bind+chain (デッキ公開→該当者を登場 系)
- カットイン filter (rules/gates 既知 DEFER)

step 2 以降 (level-modify→multi-target pick→char→hand bounce→deck-reorder→set-card) で順次解禁。

### touched files

- engine: 0 (engine 修正なし — 既存 hook 利用のみ)
- 新規カード 10ファイル + tests 1 + _reuse/index.ts + engine-extension-plan.md + changelog-entries 1
