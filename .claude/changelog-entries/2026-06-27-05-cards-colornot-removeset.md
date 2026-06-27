# cards — wave colornot-removeset-0627 (engine変更0、recent-unlock 初投入 3枚)

**Round/Phase**: 2026-06-27 カード追加 wave (engine変更0)。session60 解禁の **colorNot filter** と
session59 解禁の **removeSetCard cost** を production で初投入し、両 engine 追加を実カードで de-risk。

## 出荷 (printings +3、engine変更0)

| printing | カード | 要点マッピング |
|----------|--------|---------------|
| B07012 / B07012P | 本堂瑛祐 (青 char, 高校生) | a1=【解決編】【登場時】自陣に colorNot:青 のキャラ有(sceneHas some説)→相手 Lv4以下1枚まで sceneToDeck(bottom) / a2=ヒラメキ remove area の colorNot:青+高校生 を1枚まで handAddFromRemove |
| B07048 | 白馬探 (白 char, 探偵/高校生) | a1=【登場時】自デッキ上1枚を裏向きで自身に charSetCard($self, fromDeckTop) / a2=【パートナー白】【宣言】【ターン1】cost=removeSetCard n2 → draw1+discard1 |

## 機構

- **colorNot (some説)**: 「【X】以外の色を持つキャラ」= X以外の色を1つ以上持つ (公式 B08079)。B07012 は
  colorNot を **条件 (sceneHas)** と **target filter (hirameki handAddFromRemove)** の両方で使用。production 実証は
  B02010 a1 (BUG-159 fix) に続く 2例目。mono-青除外 / 2色{青,X}該当を decoy test で 1対1 固定。
- **removeSetCard cost (初実用カード)**: session59 で COST union/canPay/pay へ配線済の新 cost kind を、
  B07048 a2 が初めて production で使用 (codegen 非対応 → 手 author + 専用 test)。canPay=自陣裏向きセット合計≥2、
  「合わせて」= 複数 host 跨ぎ可 (公式 qa)、表向きセットは非計上 (「裏向きで」)。
- 全 atom/cond/cost/filter は出荷済 engine の proven 機能のみ (sceneToDeck/handAddFromRemove/charSetCard/
  partnerColor/caseStatus/sequence/conditional)。engine src 変更 0。

## 検証ゲート

- tsc0 / 専用 test 15 pass (構造 1対1 + colorNot matchOneFilter decoy + sceneHas evalCond + removeSetCard canPay) /
  full vitest 3149 pass 0 fail / smoke winsA=498 不変 exceptions=0 (engine変更0 の機械保証) / 8 lints errors=0。
- opus 4-lens 敵対 review (semantic-equivalence / additivity / dsl-traps / edge-test-adequacy)。
