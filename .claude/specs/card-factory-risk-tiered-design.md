# Card Factory — リスク階層化 batch 設計 (2026-06-28)

> 目的: カード実装の **session 数 / context 切替** を潰す。`速度<精度` は破らず、
> 新規性ゼロのカードの検証税だけを機械化して 1 session の出荷枚数を 5→30+ に上げる。
> 根拠: 過去 batch 実績 (2026-06-04 単純572枚・catalog-reuse 172枚)。後退原因は
> batch が遅いからでなく **分類器が engine gate を過大評価**したから (reuse 再分類)。
> 今は `taskA-validate-specs.cjs` が engine0 を機械証明 → 過大評価を構造的に排除できる。

## 1. 分類器 (keystone, 決定論)

候補カードの compiled DSL から **fingerprint** を抽出: 使用 {verb, filter種, cost種,
hook/trigger種, condition種} の集合 + effect-structure skeleton (sequence/conditional/
choice/optional の入れ子を color/数値/名前を抽象化して hash 化)。

EXEMPLAR-SET = 既出荷 **かつ test green** の全カードから抽出した上記 tuple/skeleton 集合。

| 層 | 機械判定 | 意味 |
|---|---|---|
| **T0 実証再利用** | skeleton が既出荷 exemplar 1枚と **同型** (param 差のみ) | 新規性ゼロ |
| **T1 新規組合せ** | tuple 全部 ∈ EXEMPLAR-SET だが同型 exemplar 無し | 既知部品の新結合 |
| **T2 新規機構** | tuple のどれか ∉ EXEMPLAR-SET | primitive 不足/hand-author/engine gate |

validate-specs が engine0 を機械証明するので T0/T1 が engine 変更を隠し持てない。
yellow/cost 疑義は従来通り T2 扱いで DEFER。

## 2. 各層ゲート

- **T0**: ① validate-specs (engine0) ② **TSV↔DSL 機械突合** (§3) ③ tsc。opus・certify 敵対・
  playwright は **省略** (exemplar で支払い済、新規性ゼロ)。1 session に 30〜50枚。
- **T1**: T0 + grounding certify (敵対 panel 無) + batch 末尾 1-lens opus (semantic-equivalence)
  を **batch 一括** (枚毎でない)。10〜20枚。
- **T2**: 現状フルゲート維持 (certify 敵対 + 4-lens opus + playwright 実機)。現状の枚数。

## 3. TSV↔DSL 機械突合 (T0 の意味担保, fingerprint の盲点を塞ぐ)

fingerprint 同型は「色/数値/filter 誤写」を捕まえない。対策 script:
TSV 原テキスト (col10 effect/11 cutIn/12 hira/13 henso) から **literal** を parse —
数値 (AP/LP/Lv 閾値)・色【X】・枚数 (N枚/N枚まで/X)・特徴[…]・カード名 — し、各々が
DSL の対応 param に **1対1で出現**することを assert。未対応 literal or 不一致 → fail =
human/opus に escalate。これで T0 から opus を外しても誤写は機械で止まる。

## 4. batch 検証粒度 (T0)

full vitest/smoke は **batch 末尾 1回** に集約 (枚毎でない)。engine0 ゆえ smoke 不変は
機械保証、vitest 回帰のみ希少。回帰時はカード毎の decoy test が既にあるため犯人特定は軽い。

## 5. engine gate の 2-session ping-pong 解消

engine session で **低コスト gate を ROI 順に一括**実装 (例: continuous level-delta +
ability-presence filter + removed-by-this-effect を 1 engine commit) → 直後の card wave で
全消費。primitive family 毎に session を割らない。高 ROI 順は DEFERRED-INDEX gate 別集計で確定。

## 6. onboarding 税

`.claude/specs/card-factory-state.md` (≤100行) を 1 個持ち、session 開始時の再導出
(CLAUDE.md+rules30+structure+memory) を圧縮: 現 EXEMPLAR-SET 概要 / 次 batch 候補 / engine gate ROI 表。

## 7. 構築順 (この spec 承認後)

1. 分類器 script (`scripts/card-classify.cjs`): 全候補を T0/T1/T2 に振り、件数表を出す
2. TSV↔DSL 突合 script (`scripts/card-text-crosscheck.cjs`)
3. card-wave skill に T0/T1/T2 分岐を追記 (現 skill は全カード T2 相当)
4. 初回 T0 batch (30枚目標) を 1 session で出荷し効果実測 → cadence 確定

## 8. エッジ/リスク

- **分類器の過小評価**: 同型判定が厳しすぎ T0 を取りこぼす → 安全側 (T1 で拾う、漏れても無害)
- **EXEMPLAR-SET 汚染**: test 無し/未 green カードを混ぜると T0 が腐る → 抽出条件に test green 必須
- **TSV parse 漏れ**: 新表記の literal を見落とす → 未対応 literal は fail-closed (escalate)
- **skeleton hash 衝突**: 異なる意味が同 hash → param 突合 (§3) が第2 gate
- **engine gate batch のリスク増**: 複数 primitive 同時 → 各々 TDD + 1本に統合後 full suite + 4-lens
- **T0 でも 1試合 playwright を全廃しない**: batch 毎に代表1枚は実機通し (盤面回帰の最終網)

## 9. 効果見積り

buildable ~220枚: 現状 40+ session → T0 中心で **5〜8 session**。token は certify 200k/rep を
T0 で焚かない分激減。session 数 = 痛みの直撃点を最大圧縮。
