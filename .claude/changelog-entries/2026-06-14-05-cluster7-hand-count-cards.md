# cluster7 — engine変更0 card-authoring (hand-count condition 初消費) 2枚

**Round/Phase**: 2026-06-14 cluster7 (`cards/wave2-cluster6` 上に積載)。engine拡張 wave#2 とは別軸の
**engine変更0 (骨格凍結原則完全準拠) card-authoring**。cluster4 triage で「hand-count condition」ゲートが
vacuous (条件は既存) と判明する一方、その下で **B07067 / B07070 が現行 engine で完全実装可能** と vetted
されていたものを出荷。両カードは `handAtMost` / `handCountAtLeastOther` 条件の **最初の消費者**。

### 解禁カード 2枚 (engine 変更なし)

- **B07067 沖矢昴** (赤 lv8/ap7000/lp2, 大学院生, R):
  - a1【パートナー赤】【登場時】相手手札 ≥ 自分手札なら、レベル8以下キャラ1枚までリムーブ
    (`partnerColor` + `enter` + `conditional{handCountAtLeastOther{opp}}` + `sceneRemove` levelMax8)。
  - a2【宣言】【ターン1】〚レベル6以上【赤】を1枚スリープ〛：レベル7以下キャラ1枚までリムーブ。
    宣言ゲート = 手札2枚以下 ∧ 自身が sleep/stun (`and[handAtMost:2, custom(自己 state)]` + `sleepChar` pick cost side:self)。
- **B07070 新出智明** (赤 lv5/ap5000/lp1, 医師, C):
  - a1【登場時】手札2枚以下なら、レベル7以上【赤】キャラ1枚に AP+1000・〚突撃〛(ターン終了時まで)
    (`conditional{handAtMost:2}` + `charModifyAP{turn,bind:'$picked'}` + `charGrantKeyword{$picked.uid,突撃,turn}` pick-share)。
  - 【カットイン】AP+2000 (`$contact.byUid` contact-scope)。
- ALL_CARDS 1163→1165。

### 設計ゲート (card-wave certify)

- 2 opus agent が grounding→draft→自己敵対検証。返却 DSL の主張をオーケストレータが決定論 grep で独立再検証:
  `handAtMost`=`hand.length<=n` / `handCountAtLeastOther{opp}`=`opp.hand>=self.hand` (等枚数 true、qAndA) /
  `charModifyAP` carrier `bind:'$picked'`→`$picked.uid` (B07079) / `charGrantKeyword{$bound.uid}` (PR181/PR187) /
  top-level `custom` Condition (B07071) / `sleepChar` pick cost side:self (B03060) / `$contact.byUid` cutin (B07006)。
  すべて既存カードで実証済パターン → 新 primitive ゼロ。
- ⚠ 教訓: B07067/B07070 は `handAtMost`/`handCountAtLeastOther` の **初の消費者** (triage の「B07081/B09092 が使用」は誤り、
  grep で 0 hit 確認)。条件 handler を専用 vitest で pin。

### 検証

- 挙動 pin 6 件 (`tests/cards/cluster7-hand-count-cards-behavioral.test.ts`): B07070 手札2以下→AP+1000・突撃 (filter で
  level6赤/level7青 decoy 除外) / 手札3で gate off / B07067 a1 相手≥自分→リムーブ・相手<自分で gate off・等枚数で成立 /
  a2 宣言ゲート (active 不可 / sleep・stun 可 / 手札3 不可)。
  - **PA 短縮形 (charModifyAP/sceneRemove) は実行時 atom-handler 解決** (resolve-picks.ts:438) のため、
    test harness は runEffect → `_drainAllEffectPicksForTest` (AI drain) を produce 2 段で駆動 (cluster4 同型)。
- cheap gates green: tsc --noEmit exit 0 / targeted vitest 6 pass。engine変更0 (src/engine 無改変) のため
  full vitest + smoke:1000 baseline + e2e playwright は cluster6 と合算で後追い実行 (ユーザー指示)。
  新カードは非 MVP → smoke は no-op 回帰のみ (BUG-132 教訓、新挙動は上記専用 vitest で実証)。
