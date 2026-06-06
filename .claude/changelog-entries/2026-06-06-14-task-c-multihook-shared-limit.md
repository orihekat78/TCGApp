## タスク C: multi-hook 共有【ターン1】(reasoning:end + action:declare) + 5 枚

**Round/Phase**: 2026-06-06 session — reasoning 残 new-feature 第2弾 (お勧め順 ②)。
「推理か**アクション**したとき」+【ターン1】= 2 hook を跨いだ共有回数制限を additive 解禁。

### engine 拡張 (additive — TriggerDef.hooks + listener match + action payload)

- **TriggerDef に `hooks?: HookName[]`** を追加 (card-def.ts)。`hook` に加え列挙した hook でも発火。
- **listener match** (triggered.ts): `trig.hook === hookName || trig.hooks?.includes(hookName)` に変更。
  limit:{kind:'turn'} は ability.id 単位の declaredUseCount で数えるため、**共有【ターンN】が自動成立**
  (推理 or アクションのどちらか 1 回。同ターンに両方では発動しない)。
- **action:declare emit** (state-machine.ts): payload に `uid/player` を併記。triggerCharMatches が
  payload.uid/player を読めるよう reasoning:end と統一 (B04039「[白馬探]がアクションしたとき」の gate 用)。
  既存 consumer は byUid/target / source.uid (selfOnly) のみ参照のため完全 additive。

### 対応カード (5 枚)

- **D03007 白馬探** (白Lv6): このキャラが推理かアクションしたとき1ドロー (selfOnly + 共有【ターン1】、最小ケース)。
- **B04039 ワトソン** (白Lv5): 自分の[白馬探]が推理かアクションしたとき1ドロー (triggerCharMatches、action 側も gate)。
- **B02004 毛利蘭** (青Lv6) + 再録 **D10023 / PR173**: a1=【絆工藤新一】+【ターン1】推理かアクション →
  リムーブの[妃英理]/[毛利探偵事務所]Lv5以下を1枚登場 (enter-from-remove) / a2=【相手ターン中】【現場リムーブ時】→
  リムーブの[工藤新一]を1枚手札 (leave:to-remove + handAddFromRemove、既存)。

### 検証

- typecheck clean / 全 vitest **1844 pass / 1 skip / 0 fail** (回帰0) / lint errors=0。
- unit `tests/cards/multihook-shared-limit-batch.test.ts` 6 件 (推理↔アクション共有【ターン1】両順 /
  action triggerChar / 非[白馬探]不発 / 絆 gate + enter-from-remove)。
- e2e `tests/e2e/multihook-shared-limit-2026-06-06.spec.ts` 2 pass (実フロー: 推理ドロー / 本物のアクション[事件]ドロー)。
- 回帰 e2e (action[事件]/guard/cutin/contact = bug-006/cutin-handzone/audit-suspects) 6 pass。
- ALL_CARDS 959 → **964**。

### 残課題

- 同一カードで推理→アクション両方を 1 ターンに行うには再アクティブ化が要る (共有 limit の数え方は unit で網羅)。
- 次: ③ set-card 除去 verb (B08034) / ④ evidence 抑制 (B03038)。
