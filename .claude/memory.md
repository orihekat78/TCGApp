# 作業ログ — 名探偵コナンTCG プロジェクト

> 当日の詳細 (session①cluster8 / ②BUG-145 / ③赤魔術family / ④family残 / ⑤cluster9) は
> [sessions/2026-06-15.md](sessions/2026-06-15.md)。changelog-entries 2026-06-15-01〜06 に各 Phase 記録済。

## 2026-06-15 セッション⑤ — engine拡張 wave#2 cluster9 (setcard:leave hook) ＋ batch 方針

ユーザー方針: 残 backlog の engine gate を **1セッションで複数・別コミット**で進める (cluster9/10/11)。
mega-commit は回帰切り分け不能のため禁止 = 1 gate=1 独立コミット。triage workflow で次クラスタ選定:
landscape=残 **19 独立 engine gate** (name-designation 11/partner-area 9/aura 8… が高レバレッジだが needs-design)。
A/B/C 比較で **A (setcard:leave) が唯一 ready-now・smoke 影響実証ほぼ0** → cluster9 に選定。

### cluster9 成果 (全 gate green, ALL_CARDS 1174→1177、branch cards/wave2-cluster9-setcard-leave)

- engine 5点 additive: HookName `setcard:leave` / TRIGGERED_HOOKS / scene.ts emitSetCardLeaves helper を
  removeToRemove・toDeck・toHand の **host splice 前** per-entry / char.ts removeOneSetCard emit / cjs whitelist。
- opus 3-lens 敵対設計レビュー = **GO / 0 blockers**。emit-before-splice が self-leave Q&A (B07034 自身離場)
  を支える load-bearing 不変条件 (FIX-1 = 専用 test でピン留め)。
- 解禁5枚: B07034/B07034P/PR231 a1(setcard:leave side:self+caseTrait赤魔術+turn+limit2)+a2(declared) /
  B02020/B02020P a1(side:opp+turn+limit1, charSetCard self+draw)。P 変種は spread。
- gate: tsc0 / full vitest **2181**(+9) / smoke winsA=498 baseline完全一致 (MVP は charSetCard 0枚=no-op) /
  eslint(変更分)0 / CI lint 8本 errors0 / lint:icon OK(shipped=1177) / playwright 回帰。
- known-gap (DEFERRED-INDEX cluster9): faceUp vacuous / cross-char 同時離場 順序依存 / selfToDeckBottom コスト除外。

### batch 結果 (cluster9 出荷 + cluster10/11 は defer、findings 2件)

batch「3 低リスク gate」の前提は certify/diag で崩れた (landscape の未精読 gate risk 評価は信用不可):
- **cluster9 ✅ 出荷** (7a89c5dc, CI green)。
- **cluster10 (loseGame) ⛔ defer** (197e1207 で記録): loseGame verb 単体は 0枚解禁。全敗北カードは
  事件解決能力 書き換え (勝利条件介入 high-risk) or 証拠reveal+特徴[犯人]≥8 の重い別 gate を伴う multi-gate。
- **cluster11 (enter-source-level) ⛔ defer**: **BUG-146** に block。effect/能力による登場 (sceneEnter/sceneSwitch atom)
  で entered char の【登場時】(selfOnly) が **engine 全体で不発火** (atom が enter emit source を ctx.source=原因カード
  にしており selfOnly 不一致)。diag で経験的確認 (enterSource 条件ロジック自体は正)。partial work は破棄 (main クリーン)。

### 次セッション候補

- **BUG-146 修正 + enterSource + cluster11 を専用クラスタ**で同時出荷 (登場 emit source を登場キャラに統一 +
  原因カードは payload。全 enter listener 水平展開 + smoke 再 bless + 敵対レビュー必須の高リスク広域変更)。
- or backlog の別 gate (DEFERRED-INDEX landscape: name-designation 11/multi-card sceneEnter 6 等、いずれも needs-design)。
- **教訓**: landscape の未精読 gate の「low risk」は信用せず per-card certify/diag で実証。A (setcard:leave) のみが真の ready-now だった。

## 2026-06-15 セッション⑥ — engine拡張 wave#2 cluster11 (BUG-146 + enterSource、coupled 出荷)

ユーザー選択: 「BUG-146修正 + cluster11」(高リスク広域 engine 変更)。branch `engine/wave2-cluster11-enter-source`。

### 成果 (ALL_CARDS 1177→1181、全 gate green)

- **BUG-146 修正**: atom-handlers sceneEnter:768/sceneSwitch:794 の enter emit source を `ctx.source`(原因カード)→
  **登場キャラ** `{player,uid:newChar.uid,cardId}` に統一 + 原因カードを payload.sourceCardId へ additive 移送。
  → 効果登場キャラの【登場時】/【疾風】が発火 (旧:永久不発) + 原因カードの誤発火を解消 (旧:28枚 spurious)。
- **新 condition `enterSource`** (4点同期): payload.viaEffect + sourceCardId def の CardDef-static filter 評価。
- **解禁4枚**: B01014/B01015/B01021 (or[char≥3,event≥3] viaEffect) + B07019 (解決編+緑event+BUG-145 self-sleep gate)。
- **certify+敵対レビュー**: opus 7-agent wf (4 certify + 3-lens design review) = 全 GO-with-fixes / 0 BLOCK。
  certify が B07019 の chain(not sequence)/sceneSetState(not sleepSelf)/event-level≥3 を検出 → 反映。
  edge-case lens が scratch-apply で **回帰 2 test を実証** → look-top-n / leave-reanimate(PR155) を正挙動に更新。
- **gate**: tsc0 / vitest 2197(+16, cluster11-enter-source.test.ts) / validate 73-0 / **smoke baseline 不動**
  (winsA498/avg11.00→10.998/0例外、再bless不要) / playwright 119 / CI lint 全errors0 / lint:icon shipped=1181。

### 次セッション候補

- backlog の別 engine gate (DEFERRED-INDEX landscape: name-designation 11枚 / multi-card sceneEnter 6枚 等、needs-design)。
- 低 urgency engine bug 群 (reasoning 由来 refresh = BUG-142 水平展開 等)。
- **教訓**: certify は実装前に encoding の構造誤り (chain/cost-vs-atom/条件束縛) を捕捉する。敵対 edge-case lens に
  scratch-apply で回帰 test を先取り発見させると後工程の手戻りが消える。高リスク広域 emit 変更でも consumer を
  決定論 grep で全列挙 (今回 source consumer=2点・非selfOnly listener=PR117/118 のみ) すれば水平展開は収束する。
