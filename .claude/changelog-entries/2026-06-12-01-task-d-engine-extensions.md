# Task D — engine 拡張 高リスク wave#1 (E0〜E4) + 既存バグ3修正

**Round/Phase**: 2026-06-12 session — Task D (骨格凍結の user 承認例外、engine-extension-plan 最終段)。
🟡 678枚の優先度上位 4 gate + 横断 1 micro-extension を additive 実装。設計は 9-agent grounding
workflow (全 file:line 実コード照合 + 敵対検証) → `.claude/specs/task-d/` 5 spec に確定後、全て TDD。

### E1: hand-count condition (+3 condition)
- `handAtLeast` / `handAtMost` / `handCountAtLeastOther` — 手札枚数の declarative 条件
  (evidenceAtLeast 同流儀の state 直読み。「〜の場合」は effect 内 conditional、宣言ゲートは
  AbilityDef.condition、常時系は continuous condition の 3 置き場を spec 化)

### E0: pick-bind writeback (横断 pick-share 解消)
- 任意の PA pick atom に `bind:'$picked'` → runAtom preamble が ctx.bindings へ writeback、
  後続 atom が `uid:'$picked.uid'` で同一キャラ参照。human (continuation) / AI (初期 walk) 両経路を
  単一 preamble でカバー。multi-pick は全 picked を蓄積
- 「N枚まで選び、X し Y する」(1 pick 複数 atom) が DSL で表現可能に — B07093 型 DEFER の解消経路

### E2: scene→deck (+1 verb, +1 cost, +1 condition 拡張)
- `sceneToDeck` verb (PA短縮形、pos:'bottom'|'top'、rules/16 set/stacked 清掃、leave:to-remove 不発)
- `mutate.scene.toDeck` 新設 (変装専用 toDeckBottom とは別 primitive、既存挙動不変)
- cost `sceneToDeckBottom {target,n}` (canPay/pay/costToText、costParams.uids UI チャネル)
- `triggerCharMatches.excludeSource` (「このキャラ以外の〜が登場」の分割名自己一致除外)

### E3: FILE-zone (+2 verb, +2 condition, +1 hook, dyn +1)
- `fileRemoveTop {player,n,bind?}` (アシストパートナー除外=Q&A 裁定、0枚で chain break) /
  `fileFlipTop` (FileCard.faceUp 追加、既表向きは no-op=Q&A、chain 非 break の非対称を仕様化)
- condition `fileTopMatches {side,filter}` / `triggerPlayerIs {side}`、hook `file:pop` card-triggerable 化
- `fileAdd` にデッキ0リフレッシュ guard (rules/14)、dyn `$self.fileCount`

### E4: textual-ability grant (非キーワードテキスト能力の付与)
- 統一 reader `read.char.hasTextAbility` (turnEffects flag + 'text:' 擬似キーワードの 2 チャネル)
- token 配線: `actionTargetsActive` (target-expander) / `sleepGuard` (guard.candidates、スタン不可) /
  `contactImmune` (snapshotAP で正規配線 — **judge は既読・writer ゼロだった**) /
  `removeOnTurnEnd` (**typed 済・consume 未実装だった**) + `toDeckBottomOnTurnEnd` を endTurn で consume
- duration 拡張: '_oppTurn' / '_action' suffix + clearTurnEffects に 'action' scope 追加
  (contact-end→action-end と abortIfMissing の両経路で清掃、rules/08 §6-7)
- `charGrantAbility` verb — triggered ability の動的付与 (JSON descriptor、validate で closure/
  leave:to-remove hook を拒否)。triggered.ts handleHook が def.abilities と合算走査
- condition `charTurnEffect {key}` + `triggerCharMatches.payloadKey` (guardUid 評価)、
  AI 経路に tryGuard/passGuard 直後 drain 追加 (granted 効果を judge 前に解決)
- **DEFER**: mustGuard (ガード強制の AI/UI 同時追従が必要) / auraGrant (B09024) は次 wave

### 既存バグ修正 (grounding 中に発見)
- **BUG-128**: `filePopToHand` が placeholder 'card-back' を手札に push (next-hint と非対称の stale)
- **BUG-129**: cost `fileFrom` がカードをゲームから消失させる (remove 行き欠落) + canPay の
  アシストパートナー込み計数 (rules/21 違反)
- **BUG-130**: B02040/B02040P/B02046/B02046P の sequence 後続 atom `uid:'$pick'` が silent no-op
  (AP+ 不発)。E0 pick-bind で機構解消 + 4 カード修正 (全カード走査で他に同型なし)

### 検証
- 全拡張 TDD (新規 56 テスト)。full vitest **1955 pass / 1 skip / 0 fail** (回帰 0)。typecheck clean。
- whitelist 同期: scripts/taskA-validate-specs.cjs (VERBS/CONDS/COSTS/HOOKS)
- touched: engine 17 files (additive) / cards 4 (BUG-130) / tests 7 / specs 5 (新規 task-d/)
