# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-06-24.md](sessions/2026-06-24.md) (セッション55〜57)。
> 再開手順は `.claude/NEXT-SESSION-PROMPT.md`。

## 現在地 (2026-06-24 セッション58 完了 — engine additive wave)

- **main = bad13ee4** (docs) ← a206e9dc (engine additive wave) ← 813d0b19 (spec) ← d0bd58c6 (event-choose3 docs)。
  ⚠ a206e9dc = **engine 変更あり (additive)**。push 後 CI in_progress → 開始時 green 確認。
- branch `engine/additive-wave-lvldelta-stuncost-0624` = main 一致。working tree clean (`.claude/design/` ?? 除外)。
- ⚠ auto-docs (structure/mapping/CHANGELOG) 未再生成 (precedent 通り未commit・CI除外)。
- card session は worktree `C:/tmp/conan-cards-w` で並行 (engine/card 分離ゆえ衝突無し)。

## engine additive wave (lvlDelta + stunChar)

- **Gap1 ContinuousModifier.lvlDelta**: apDelta/lpDelta 完全対称。honor=read.char.level + candidates.matchOneFilter
  (BUG-117)。再帰は既存 `_inContinuousDelta` guard が depth-2 終端。B08059/B08050 解禁。
- **Gap3 Cost stunChar**: sleepChar 対称 + **n.max honor で「1枚」faithful**。honor=union/canPay/pay/UI costToText/validate-specs。B08004 解禁。
- **Gap2 carrier-reuse は stale DEFER 訂正 (engine変更0)**: bind:'$picked' 機構は 2026-06-12 出荷済 (BUG-130)、exemplar B02040。B08023 解放。
- 各 gap **opus 敵対 review (4/3 lens) = no-blocker**。pre-existing 欠陥を **BUG-156** (sleepChar/stunChar cost over-pay) /
  **BUG-157** (read.char.ap/lp 無 guard 相互再帰) に記録 (本 wave 非起因、unified 修正は別 commit)。
- gate: tsc0 / eslint+8lint 0err / vitest **3054** / smoke **winsA=498** 不変。test 15件 (lvldelta 9 / stunchar 6)。
- 流儀: brainstorming → spec → TDD(RED→GREEN) → gate → opus 敵対 review workflow → concern 反映 → FF push。実証済。

## 次やること候補 (要ユーザー選択、詳細は NEXT-SESSION-PROMPT)

A) engine additive 続き (scope array B08019 / set-card-removal cost B08033a2 / BUG-156/157 unified) /
B) MR Phase2-4 / C) カード追加 (B08023/B08050/B08059/B08004 解放済) / D) auto-docs sync。

## ⊕ 並行 card session: wave novel-0624 出荷 (engine変更0、commit 8808e549)

- 別 session が card wave を engine HEAD 上に積んで main に FF push (8808e549、engine変更0)。
  classify(59)→certify+adversarial-verify(15)→verified-ok green **9枚出荷** (B08092/B02033/B03095/
  B04019/B04079/B05014/B09063/B09066/D01008)、refuted3+yellow3 を DEFERRED-INDEX へ。
- ⚠ shared-workdir hazard 実体験: 作業中に共有 HEAD が engine branch へ切替わった。card 側は engine
  ファイル非 stage を確認し HEAD(=remote main) 上に commit→`git push origin HEAD:main` FF で衝突回避。
- gate は engine additive wave + 9枚の **合成 state** で実行 (vitest 3068 = 3054+14)、全 green。
- 新 reference memory: BUG-145 conditional 枝は Pattern-B 短縮形 atom なら安全 (over-fire は optional/choice/$pick のみ)。

## ⊕ card wave engine-unlocked-0624 (engine変更0、本 session)

- a206e9dc 解放分 4枚 (B08023/B08050/B08059/B08004) を全句 engine 実測で再 certify → **2枚出荷 / 2枚再 DEFER**。
- **出荷 B08023/P** (登場時 choice×3 carrier-reuse: 伊織無我 setCard+AP/突撃 / 相手 setCard+sleep) +
  **B08050/P** (解決編 lvlDelta+3 + 登場時 deck-look: deckRevealUntil match-all→handAdd→boundToRemove+cardNameNot discard)。
- **再 DEFER** (engine wave の「解禁」over-claim を訂正): **B08059** = self-counting latch (vitest probe 実測で
  諸星+他lv7×1→read.char.level=6、QA要求7。`_inContinuousDelta` guard が depth-2 で自己 delta を base化) /
  **B08004** = 宣言ゲート「リムーブに黒の**キャラ**3枚」が remove色+種別count を要求、removeColorAtLeast は色のみ。
- gate 全 green: tsc0 / vitest 3091(+12) / smoke winsA=498 不変 / 8lint+eslint 0。opus 4-lens 敵対 review 実施。
- 新 reference memory: [[reference-engine-unlocked-second-gate]] (解放表記を信用せず全句 probe で再 certify)。

### ⚠ 敵対 review で BLOCKER 2件検出→修正 (出荷前)
- B08023 初版 = exemplar B02040 踏襲の明示 uid:'$pick'+target carrier → **human 経路で rider 不発** (実機 AP=3000)。
  **短縮形** charSetCard{player,max,filter,bind:'$picked'} へ変換で修正。出荷済 B02040/P・B02046/P・PR049 も
  同症状 → **BUG-158** 起票 (別 session で短縮形変換 or engine 両経路統一)。
- B08050 step 順 handAdd→discard→boundToRemove は deck≤3 で refresh が discard 札を巻き戻す →
  公式順 handAdd→**boundToRemove→discard** に修正 (deck=3 回帰 test 追加)。
- 教訓: 2 lens が「B02040 同形ゆえ CLEAN」と code-comment 推論で誤判定。**empirical probe を回した lens のみ正答**。
  carrier-reuse は **human 経路実測必須**。最終 gate: tsc0 / vitest 3095 / smoke winsA=498 / 8lint+eslint 0。

## 2026-06-27 card wave novel-tail-0627 (engine変更0、6枚出荷)
- 残 green候補 154 を機構別分類 → clean homogeneous クラスタ枯渇 (易 deck-look 出荷済) 確認。
- single-mechanism 16 rep を wf-certify (opus, SUB=5): green6/verify-ok5/refuted1/yellow10。
- 出荷6 = D07018 ジン / B02008 阿笠博士 / B07024 ハチ / B02073 上原由衣 / D02005 遠山和葉 / PR036(clone)。
  全て a2=ヒラメキ (recs の hira 列、certify が拾う)。
- D02005 refuted→**a2 sceneSetState に uid:'$pick' 追加** (BUG-140、短縮形は hiramekiResolve auto-resolve で no-op、
  ground truth B03038/D05007 a2 が両方 uid:'$pick' 保持) → opus 再 verify ok → 出荷。
- **B06058 = 自己review で DEFER** (certify+verify は ok だったが a1 `chain[discard max1, sceneSetState max1]` で
  「そうした場合」optional gate 喪失 = discard 0 でも activate 発火 + 短縮形 side:'self' hardcode 'either' 疑い)。
  → certify green-ok でも codegen 前の自己 review が捕捉した好例 ([[feedback-certify-spec-self-review]])。
- **B07048 白馬探 = READY 未出荷**: a2 cost=removeSetCard n2 (session59 解禁) の初実装候補。codegen 非対応→手author要。
- gate: tsc0 / wave test 9pass (構造1対1 6枚 + B02008 enter decoy gating) / smoke winsA=498 不変 / 8lint 0 /
  playwright app-load console err 0。⚠ 並行 session BUG-156/157 WIP (char.ts/pay.ts/candidates.ts M + 偽fail test) は orthogonal、自commit不含。
