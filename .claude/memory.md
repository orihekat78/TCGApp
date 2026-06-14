# 作業ログ — 名探偵コナンTCG プロジェクト

## 2026-06-15 セッション (BUG-143/144 + reanimate確認 + cluster8、local 5 commit)

ユーザー要望「バグ修正 + 残り3件 + cluster8 を1セッションで」を実施。**push せず local のみ** (ユーザー指示)。
main は origin より **5 commit 先行** (要手動 push)。各 commit は local ff-merge 済、全 gate green。

### commit (古い順)
1. `9911afe9` **BUG-143**: contact-scope 修正値 (apMod_contact等) を contact-end で清掃 (rules/08 §6)。
   clearTurnEffects に scope 'contact' 新設 + state-machine contact-end で呼出。TDD red→green。smoke baseline 不変。
2. `19cdaa23` **BUG-144**: AI のアクション[事件] ガード窓。resolveActionAgainstCase に defenderPolicy.chooseGuard
   委譲 (ガード成立→AP判定/不成立→証拠操作)。policy.applyMove が HeuristicPolicy 渡す。smoke re-baseline
   (avg 10.86→11.00, winsA 469→498)。
3. `399e553d` **reanimate 確認 + BUG-145**: B06052/D05006/PR138 は前 batch で実装済 (certify-record gap のみ)。
   certify queue 254/254 完走。B06052/D05006 正しい。**PR138 = certify false-green 検出** (a2 self-sleep optional が
   already-sleep 時に chain break せず qAndA違反、sceneSetState 冪等) → BUG-145 起票 + DEFER (self-state condition 必要)。
4. `764be98d` **cluster8 ヒラメキ抑止窓**: B06049 a2「アクション[事件]したとき相手の【ヒラメキ】発動しない」。
   新機構 = TurnScopedFlags.hiramekiSuppressed + setHiramekiSuppress verb (3点同期) + handleEvidenceRemovedHook 抑止
   + action-end 清掃 (cluster6 setEventUseBan の action-scoped 版)。敵対設計レビュー(opus)=sound 後実装。
   B06049 解禁 (a1=D08011同型/a2=新機構/a3=PR138同型)。ALL_CARDS 1166。専用 behavioral test 4件 (制御込)。
5. `521b7646` **BUG-144 follow-up**: bundled actionAgainstCase dispatch を passGuard に revert。playwright で
   hirameki e2e 8件回帰検出 → bundled 経路は hirameki demo(App.tsx)/e2e 専用で防御 auto-guard が evidence 除去阻害。
   実ゲーム防御窓は per-step (useContactFlowDriver) で対応済。BUG-144 本体 (policy.applyMove) は維持。

### 全 gate (最終状態)
- full vitest **2113 pass** (1 skip)。tsc clean。
- smoke:1000 baseline **winsA=498/avg=11.0** (BUG-144 で re-baseline、cluster8 は no-op で不変)、timeouts/exceptions=0。
- playwright **全 119 pass** (follow-up 後、hirameki 14/14 含む)。
- validate-specs pass=73 fail=0。

### 教訓
- **certify+adversarial-verify が green でも意味等価は自前で1対1突合** (PR138 false-green、B01011 同様)。
- **engine 変更は playwright まで回す** — BUG-144 の bundled-path 過剰拡張は vitest/smoke を通過し playwright で初検出。
- bundled `actionAgainstCase` (useEngineDispatch) は hirameki demo/e2e 専用 = 防御 auto-guard 禁止。

### 未 push (要ユーザー手動 push) / 残課題
- `git push origin main` 未実施 (5 commit)。push 後 CI 確認推奨。
- BUG-145 (PR138 self-sleep gate) = self-state condition 追加の将来 micro-cluster。
- bug hash 反映: BUG-143/144/145 の commit プロパティは placeholder/branch名 (要 real hash 反映、任意)。
