# Task D E1 — hand-count condition (手札枚数条件)

rules: 15(解決時参照) 17(条件アイコン=未達なら能力なし) 21(宣言ゲート) 24/25(常時系・解決順) 14/26(リフレッシュ非干渉)

## DSL (Condition union に additive 追加、JSON-serializable)

```ts
| { kind: 'handAtLeast'; player: 'self' | 'opp'; n: number }   // 手札が n 枚以上
| { kind: 'handAtMost';  player: 'self' | 'opp'; n: number }   // 手札が n 枚以下
| { kind: 'handCountAtLeastOther'; player: 'self' | 'opp' }    // player の手札 >= 反対側の手札
```

- handAtMost を not(handAtLeast n+1) に畳まない: 8 sig 中 5 が「N枚以下」形、公式テキスト 1:1 対応 (declaredUseUnder 前例)
- 評価: `state.players[resolvePlayer(cond.player, ctx)].hand.length` 直読み (evidenceAtLeast eval.ts:103-106 と同流儀)。
  candidates() を経由しないので BUG-113 系再帰なし
- evalCond switch は default なし + boolean 戻りで、case 追加漏れは TS exhaustiveness エラー (安全網確認済)

## touched files

1. `src/engine/types/effect.ts` — Condition union +3 (evidenceAtLeast 直後)
2. `src/engine/cond/eval.ts` — case +3
3. `tests/engine/cond/eval.test.ts` — describe 3本 (境界 n-1/n/n+1、0枚、owner-relative、両者0枚比較)
4. `scripts/taskA-validate-specs.cjs` — CONDS whitelist +3 (漏れると wf-certify 生成 spec が全 FAIL)
5. (自動) `npm run docs` — validate.ts は Condition kind を検査しないため変更不要 (validate.ts:90-98 確認済)

## カード側の使い分け

- テキスト「〜の場合」→ effect 内 `conditional` (解決時評価 = rules/15)。**ability.condition に置くと queue 時評価になり裁定違反** (B08093 a2 等は必ず effect 内)
- 宣言ゲート「この能力は手札が2枚以下…の場合に宣言できる」→ AbilityDef.condition (canDeclaredAbility declared-ability.ts:87-97 が評価、AI/UI 自動波及)
- 常時系 → continuous の condition (読み取り毎再評価 = rules/24)

## edge cases (検証済)

1. 手札0枚: handAtMost 恒真 / handCountAtLeastOther は 0>=0=true (「以上」=同数含む、B07067 Q&A 一致)
2. 【登場時】条件は手札から使用したカード自身を数えない (B07067/B07070 公式Q&A)。enter hook は移動完了後評価で自然に正 → テスト+checklist §7 decoy で「手札3枚目として登場→handAtMost(2)=true」を必ず踏む
3. 効果列内の枚数変動 (B07081「加えた後6枚以上なら」) — sequence/chain の step 実行時 evalCond で正
4. コスト先払い後評価 (rules/21): 宣言ゲートはコスト前 (canDeclaredAbility 時点)、効果内 conditional はコスト後
5. リフレッシュ: 手札はシャッフル対象外、draw 途中リフレッシュは rules/26 (再開後評価) と整合
6. カットイン/変装で手札が減るとコンタクト中に常時系条件が flip — AP判定直前の枚数を E2E で確認

## verdicts (敵対検証後の確定)

| card | verdict | 残 gate |
|------|---------|---------|
| B09092(P) | ✅ unlocked | なし (phase:end:start+choice+scratchTrace+mill+宣言 全既存) |
| B07081 | ✅ unlocked | なし (chain+handAddFromRemove+discard 既存) |
| B07070 | E0 で解禁 | pick-share (1 pick→AP+1000 と突撃 grant の 2 atom) → E0 pick-bind |
| B07067 | partial | a2 後半 selfState condition (自キャラ sleep/stun ゲート) 不在 |
| B08093 | partial | a1 reveal-cost + ability-possession filter / MR能力①②+partner-area 宣言句 |
| B08047 | partial | a2 until-N discard cost (a1 は有限展開 conditional で可) |
| B07076/B07100 | still-blocked | until-N discard / sum-constrained pick / reveal verb / cutin禁止 flag |

## リスク

- 回帰 0 (純 additive、既存行不変)。doc 同期: capability-map.txt:192 / card-condition-catalog.md は次回 survey 時更新
