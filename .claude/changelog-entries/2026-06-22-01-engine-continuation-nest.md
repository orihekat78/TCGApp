# engine: continuation-nest 修正 (BUG-111 #3) + B06033/B06033P 解禁

**Round/Phase**: 2026-06-22 engine 拡張 cluster (骨格解凍、ユーザー明示)。
pick の continuation が **nest 非対応**だった BUG-111 family の 3 番目の発現を修正し、
`sequence[chain[pausing-pick, …], …]` 構造のカードを解禁。

## 根因 (BUG-111 #3)

`sequence[ chain[evidenceToHand{pick}, handToEvidence], sceneEnter ]` のように pick が chain (内側) と
sequence (外側) の **2 重**に囲まれて pause すると:

1. chain が `pick.continuation = {remainder:[handToEvidence], kind:'chain'}` を同梱 (resolver 旧 L75)。
2. 直後に親 sequence が **同じ slot を `{remainder:[sceneEnter], kind:'sequence'}` で上書き** (旧 L48)。
3. → chain remainder (handToEvidence) が脱落。

continuation が pick あたり単一 slot で、最外殻 (sequence) のみ残り内側 (chain) を黙って捨てていた。

## 修正 (engine、TDD)

continuation を recursive な linked list `ContinuationFrame { remainder, ctx, kind, outer? }` に拡張:

- `resolve-picks.ts`: `PendingEffectPickSide.continuation` 型を `ContinuationFrame` に。
- `resolver.ts attachContinuation()`: 既存 continuation があれば**上書きせず** `outer` 末尾に append
  (head=内側 chain → outer=外側 sequence の順で実行)。sequence/chain 両 case が使用。
- `apply-pick.ts runContinuationChain()`: head → outer を順次 runEffect + runAllUntilEmpty。
  ある frame の remainder 実行中に**再 pause** したら、残り outer frames を新 pick へ引き継いで停止
  (外側 remainder は新 pick の解決時に実行)。`applyPickAndContinuation` / `applyPickSkipAndContinuation` が使用。
- decline (`applyPickSkipAndContinuation` / `drainAiEffectPicks` / `useEngineDispatch.effectPickResolve` の routing):
  head が chain なら remainder を gate (skip、「そうした場合」rules/25) しつつ **outer は実行**
  (B06033 で swap を辞退しても 2 文目 sceneEnter は走る、rules/15 各 step 独立)。sequence head は従来通り remainder 実行。
- **単一 frame (outer 無し) は byte 互換** — 既存の全 continuation flow (BUG-105/107/111 #1/#2) は無変更。

## 追加カード (2 printings、ALL_CARDS 1372 → 1374)

- **B06033 / B06033P「わが味方となるべし!!」** (緑 L6 event、C/CP、cardId 0656):
  「自分の証拠を1つ選び、手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。
   手札からレベル6以下の【緑】の〚特徴［YAIBA］〛のキャラを1枚まで登場させる。
   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。」
  - a1 = `sequence[ chain[evidenceToHand max:1, handToEvidence n:1], sceneEnter{from:hand, max:1, viaEffect,
    filter:{color:緑, kind:character, levelMax:6, trait:YAIBA}} ]`。chain swap 部は B06029 が既出荷、差分は外側
    sceneEnter のみ (nest gate がこれを阻んでいた)。
  - a2 = ヒラメキ `handAddFromRemove{fromSelf:true}` (B05102/PR085 同型)。
  - 公式Q&A「証拠から手札に加えたカードを登場できる」= swap を先に解決→post-swap 手札から sceneEnter 候補。nest で実現。

## 検証

- 新 `tests/engine/effect/bug-111-continuation-nest.test.ts` **2 件**: Case1 (nest 保持: chain step2 + sequence
  remainder 両方発火) / Case2 (再 pause 引継ぎ: chain remainder 自身が pause しても outer 引継ぎ)。RED→GREEN。
- 新 `tests/cards/continuation-nest-b06033.test.ts` **9 件**: swap+enter (nest 非decline) / 公式Q&A (swapped card
  enterable) / sceneEnter filter 1対1 (lv6境界・lv7・色・特徴・種別 decoy) + nest-decline (swap no-op でも sceneEnter
  実行) / ヒラメキ self→hand / 構造。
- tsc clean / eslint 0 errors。vitest full **2770 pass / 1 skip / 0 fail** (前 2759 + 新 11、減なし、既存 continuation
  テスト bug-077/111#1/#2 全 pass)。
- smoke:1000 **winsA=498 baseline 完全一致** / exceptions=0 = AI 経路 byte 互換の証跡。
- playwright: pick·optional·choice·event e2e **7/7** / full-match human-vs-CPU + 観戦 **3/3** console error 0
  (engine pick/continuation flow の UI 回帰確認)。

## 学び (恒久)

- **continuation は 1 重とは限らない**: 同じ pick が複数の入れ子構造 (sequence[chain[…]]) に囲まれると、各構造が
  自分の残り step を継続として付けたがる。単一 slot 設計は黙って内側を捨てる。linked list (outer) で nest 化が正解。
- **既出荷の部分構造 + 1 gate で解禁できるカードがある**: B06033 の chain swap は B06029 が出荷済で、唯一の gate が
  外側 sequence の nest だった。gate 単位の DEFER 棚卸しで「部分既済 + 1 engine gate」のカードを発掘できる。
