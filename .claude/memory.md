# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-21-5.md = ㉛ / 2026-06-22.md = ㉝+㉞。)

## セッション㉟ (2026-06-22) — continuation-nest engine 修正 + B06033/B06033P 解禁 (C 候補2)

開始時: remote main = `aeb1bf4d` (㉞ push 済を確認)。方向 = ユーザー選択で **C 候補2 (continuation-nest)**。
branch `cards/continuation-nest-b06033`。

### 根因 (BUG-111 #3 / systematic-debugging で repro 確定)
`sequence[chain[evidenceToHand{pick}, handToEvidence], sceneEnter]` (B06033 a1) で pick が chain と sequence の
**2 重**に囲まれて pause すると、chain (内側) が `pick.continuation=[handToEvidence]` を同梱 (resolver L75) した直後、
親 sequence (外側) が **同 slot を [sceneEnter] で上書き** (旧 L48) → handToEvidence 脱落。continuation が単一 slot で
nest 不可だった。RED test (`bug-111-continuation-nest.test.ts`) で Case1=chain step2 脱落 / Case2=再 pause 時に
outer 脱落 を実証。

### 修正 (engine、骨格解凍 = ユーザー明示の engine拡張 cluster)
continuation を recursive `ContinuationFrame`(`+outer?`) の linked list 化:
- `resolve-picks.ts`: 型を `ContinuationFrame` (recursive) に。
- `resolver.ts attachContinuation`: 既存 continuation があれば**上書きせず** outer 末尾に append (head=内側→outer=外側 順)。
- `apply-pick.ts runContinuationChain`: head→outer を順次実行。remainder 自身が再 pause したら残り outer を新 pick へ引継ぐ。
- decline (`applyPickSkipAndContinuation` / drain / useEngineDispatch 経路): head が chain なら gate (remainder skip)
  しつつ **outer は実行** (B06033 swap 辞退でも sceneEnter は走る、rules/15)。sequence head は従来通り remainder 実行。
- **単一 frame (outer 無し) は byte 互換** — 既存全 continuation flow は無変更。

### B06033/B06033P「わが味方となるべし!!」(緑 L6 event、ALL_CARDS 1372→1374)
a1 = `sequence[ chain[evidenceToHand max:1, handToEvidence n:1], sceneEnter{from hand, max:1, viaEffect,
filter{緑,character,levelMax:6,trait:YAIBA}} ]`。a2 = ヒラメキ `handAddFromRemove{fromSelf:true}`。
公式Q&A「証拠から手札に加えたカードを登場できる」= swap を先に解決→post-swap 手札から sceneEnter 候補 (nest で実現)。
exemplar: B06029(chain swap) / B05102(event+sceneEnter+hirameki)。手 author (taskA codegen 非対象)。

### 検証 (全 green)
repro 2/2 GREEN / B06033 decoy 9/9 (swap+enter・Q&A・filter 1対1・nest-decline・hirameki・構造) /
full vitest **2770pass 1skip 0fail** / tsc0 / eslint0 err / smoke 1000 **winsA=498 baseline 完全一致** (AI 経路不変) /
pick·optional·choice·event e2e **7/7** / full-match human-vs-CPU + spectator **3/3** console error 0。
(非MVP のため実機 deck-builder 不可 → engine decoy が §7 文言突合を担保。)

### 学び (恒久)
- **continuation は 1 重とは限らない**: sequence[chain[pick],…] のように同 pick が複数構造に囲まれると
  各構造が継続を付けたがる。単一 slot 設計は最外殻のみ残し内側を黙って捨てる。linked list (outer) で nest 化。
- **B06033 chain swap 部は B06029 が既出荷** — 差分は外側 sequence の sceneEnter のみ。nest gate がそれを阻んでいた。

### branch / commit
branch `cards/continuation-nest-b06033`。docs同期→commit→main ff-merge→push→CI green 予定。push 後 ls-remote 確認。
