# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-22.md = ㉝+㉞ / 2026-06-22-2.md = ㉟。)

## セッション㊱ (2026-06-22) — 未解決 BUG-133〜136 一括解消

開始時: remote main = `f9b5d8be` (㉟ continuation-nest push 済を確認)。ユーザー指示 = **未解決バグ全解消**。
branch `bugs/resolve-open-133-136`。wave#2 audit (2026-06-12) 起票の未着手 4 件を systematic-debugging で処理。

### 結論 (4 件すべて green で close)
- **BUG-133** (drainAi player guard 欠如): 起票後の **BUG-138 X8** で guard 実装済を検証。新 fix なし。
  既存 bug-138-drain-ownership.test (6) が網羅。commit 指す先 = ec6c9780。
- **BUG-135** (sequence 中間 skip-drop): 起票後の **BUG-111 #2** で skip 経路が origin-kind gate に再設計済を検証。
  決定論 scan で実出荷該当形 = PR155/PR161/D03002 のみと特定。実カード回帰 bug-135-sequence-middle-skip.test (3)
  追加。commit 指す先 = a682b20b。
- **BUG-134** (triggered pick 発動時確定): probe で機構確認 (effect:declared 以外の全 hook は queue 時確定) →
  scan で **rules 違反の実害なし** (害B=追加候補→turn-end sceneEnter 0件で実在せず / 害A=削除 stale→splice
  防御で rules-correct no-op、manifesting カードも MVP smoke 外)。engine全面 fix は骨格凍結 risk 過大 → **見送り**。
  機構を bug-134-cofire-pick-staleness.test で pin。
- **BUG-136** (deckToBottomBound 順序未surface): **reorder UI 実装**。side-channel `__pendingDeckReorderSide`
  (human 所有&2枚以上のみ set、AI/smoke byte-equal) + store `pendingDeckReorder` + `deckReorderResolve`
  (multiset 検証で底ブロック再配置) + `DeckReorderModalHost` (drag+▲▼、SouzaReorderModal.css 流用) +
  useOppTurnDriver 待機/再開。**水平展開で souza (捜査X) も同配線** (defender が human&2枚以上)。

### branch commits
- `c9eeedbb` — BUG-133/135 検証 + 回帰ガード (bug-135 test、engine 変更なし)。
- `e03bdbd5` — BUG-136 実装 (engine deckToBottomBound+souza / store / dispatch / DeckReorderModalHost / App /
  useOppTurnDriver) + BUG-134 close (見送り + characterization test) + changelog entry。
- `<この doc commit>` — BUG-136.md 修正済(commit:e03bdbd5) + NEXT-SESSION + memory rotate。

### 検証 (全 green)
vitest **2783 pass / 1 skip / 0 fail** / tsc0 / lint 群 0 err / e2e (bug-136 ▲▼+drag) **2/2** console error 0。

### 学び (恒久)
- **「未解決バグ」が起票後の別 work で既解消なことがある** (133=BUG-138 / 135=BUG-111#2)。仮説 (=未解消) を
  反証する証拠 (現コード読解 + 既存テスト) を取れ。修正前に「本当にまだ壊れてるか」を repro で確認。
- **engine 全面 fix を要する narrow bug は scan で実害有無を確定してから判断** (134=見送り)。骨格凍結原則。
- side-channel 追加は 5 点パターン (declare/type/_drain + surface + post-sync + store) を踏襲 (__pendingDeckReorderSide)。

### 次タスク
未確定。NEXT-SESSION-PROMPT.md 参照 (B デザイン / C refactor / A カード)。branch を main ff-merge → push 予定。
