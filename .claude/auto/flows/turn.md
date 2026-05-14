# 🤖 ターンライフサイクル (auto → main → end)

> ⚠️ このファイルは `scripts/gen-docs/gen-flows.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:flows`
> Source hash: `adc723977ad9`

1 ターンは 3 フェイズ（auto / main / end）で構成され、6 種類のメイン行動が好きな順番で実行される。 詳細は `rules/05-turn-phases.md` を参照。

## 状態遷移図

```mermaid
stateDiagram-v2
  [*] --> auto : flow.startTurn() / turn:start emit
  auto --> main : phase:main:start emit
  main --> end : flow.endTurn() / phase:main:end emit
  end --> [*] : phase:end:cleanup emit
  state main {
    [*] --> idle
    idle --> handUseCard : 手札の使用 (1 ターン 1 回)
    idle --> nextHint : ネクストヒント (制限なし)
    idle --> partnerAbility : パートナー能力
    idle --> declaredAbility : 【宣言】能力
    idle --> reasoning : 推理
    idle --> actionFSM : アクション (action-fsm.md)
    handUseCard --> idle
    nextHint --> idle
    partnerAbility --> idle
    declaredAbility --> idle
    reasoning --> idle
    actionFSM --> idle
  }
```

## 補足

- イベント発火順 (1 ターン): `turn:start` → auto 4 emits → `phase:main:start` → ...(main 行動) → `phase:main:end` → `phase:end:start` → `phase:end:cleanup`
- 手札の使用は **1 ターン 1 回まで** （`turnState[p].handUseUsed`）。ネクストヒントを行ったターンは手札使用不可。

---

## ソース

- [`src/engine/flow/turn.ts`](../../../src/engine/flow/turn.ts)
- [`src/engine/flow/main/index.ts`](../../../src/engine/flow/main/index.ts)
