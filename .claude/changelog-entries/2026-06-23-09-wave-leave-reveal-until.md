# wave — leave-reveal-until (現場リムーブ時/登場時 → デッキ reveal-until-X → 手札/登場 7枚、engine変更0)

**Round/Phase**: 2026-06-23 カード追加 wave#9 (A 継続)。reveal-until-X デッキ探索クラスタを grounding 精査。
棚卸 signature (regex) は不可信を再実証 — 「cutin」tag クラスタは PRIMARY が cutin-use observer trigger /
set-event / event-use closure の gate だらけ (clean ほぼ0)。tag 横断で公式テキスト「出るまで1枚ずつ公開」を
決定論抽出 (20件) → full-text grounding で **leave:to-remove selfOnly + condition{turn:opp} (S394 で 30+枚成熟) ×
deckRevealUntil reveal-until (wave-08) → handAddFromDeck/sceneEnter → deckToBottomBound → deckShuffle** の
合成が両半とも engine-in = engine変更0 と確定。

## engine変更ゼロ (touched: src/cards のみ、src/engine 0 file — git diff src/engine 空が確証)

既存 settled path の合成のみ:
- `leave:to-remove` selfOnly trigger + `condition{turn:opp}` (D05007 a1)
- `deckRevealUntil {filter, bind, bindMatch}` reveal-until [no maxN] (B06053 a1)
- `conditional{bound $matched matched}` → `handAddFromDeck{cardId:'$matched.cardId'}` / `sceneEnter{from deck}`
- `deckToBottomBound` + `deckShuffle` (B06053 a1)
- `conditional{handCountAtLeastOther player:'opp'}` → `discard{player:'opp', n:1}` (cond/eval.ts:135 Task D E1 / exemplar B07067 a1 / discard opp = D04010)
- `choice{chooser:'self', options:[…]}` (D02013)、`misreadX({x:1})` (D01010)、ヒラメキ draw (D01013)

回帰ゼロ証跡: src/engine diff 0 / smoke winsA=498 baseline 不変 (新7枚は MVP デッキ外) / vitest 2910→2926 (+16)。

## 追加カード (7、ALL_CARDS 1417 → 1424、touched=各1)

- **B05021 森達夫** (青5): 【相手ターン中】【現場リムーブ時】reveal-until cardName[毛利小五郎] → 手札。
- **B03019 フサエ・キャンベル** (青5): a1 同型 cardName[阿笠博士] → 手札 / a2 【ヒラメキ】カードを1枚引く。
- **B05077 ジョディ・サンテミリオン** (赤5): 【相手ターン中】【現場リムーブ時】reveal-until cardName[ジョディ・スターリング]+levelMax4 → **登場 (active)**。
- **B07086 榎本杉人** (黄5): a1 〚ミスリード1〛 / a2 【相手ターン中】【現場リムーブ時】reveal-until cardName[榎本梓] → 手札、**加えた場合のみ** 手札1枚 discard (conditional 内包で over-fire 防止、公式Q&A)。
- **B07043 寺井黄之助** (白5): 【相手ターン中】【現場リムーブ時】choice[黒羽盗一/黒羽快斗/怪盗キッド] → reveal-until → 手札 (CPU は option0、human は3択 modal)。
- **B02058 / B02058P 赤井秀一** (赤6): a1 【登場時】相手手札 ≥ 自手札 なら 相手 discard1 (handCountAtLeastOther) / a2 【相手ターン中】【現場リムーブ時】reveal-until cardName[沖矢昴] → 手札。

## DEFER なし

全7枚 ship-clean。B02058 a1 は grounding で当初「hand-count condition 不在」と DEFER 候補だったが、敵対 verify が
capability-map.txt (2026-06-06 snapshot) の stale を検出 → `handCountAtLeastOther` (Task D E1 2026-06-12) が実在し
B07067 a1 で verbatim 実証済と判明 → full-ship。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-leave-reveal-until-2026-06-23.test.ts、15件): leave behavioral
  (removeToRemove 駆動 + reveal-until→手札/登場 positive)、cardName decoy 除外、**levelMax4 decoy** (同名 Lv7 除外/Lv3 登場)、
  **over-fire guard** (榎本梓不在→discard不発)、非match は deckToBottomBound (remove でない) 検証、
  turn:opp gate (自分ターン無発火)、B02058 a1 enter-hook 駆動 hand-count 両分岐、choice 3択構造、parallel 同一性、
  leave 系 trigger/condition 同型断言。
- **敵対 faithfulness review** (opus workflow、7カード lens、1つずつ): 全7枚 faithful=true / engineZeroHolds=true /
  **blocker 0**。concern は全て non-blocking (CPU が choice option0 固定 / B07043 黒羽快斗・怪盗キッド の split-name 対象未実装ゆえ latent /
  reveal UI side-channel は既存 reveal-until 共通 / capability-map stale)。指摘の B03019 no-match path は本 wave で assertion 追加済。
- typecheck 0 (両config) / vitest 2910→2925 (+15、baseline 不変) / smoke winsA=498 exc0 baselineOK /
  e2e 123pass+1skip / 規約 lint 8本 errors=0。

## 教訓 (capability-map stale)

`capability-map.txt` の 2026-06-06 snapshot は Task D E1 (2026-06-12) の hand-count condition 群を欠く
(⛔「hand-count condition 不在」が stale)。grounding は capability-map の **negative claim (⛔)** を鵜呑みにせず
`src/engine/cond/eval.ts` / `types/effect.ts` を直参照すること (敵対 verify が検出)。
