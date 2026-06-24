# engine — additive wave: Cost `removeSetCard` (2026-06-24)

**Round/Phase**: 2026-06-24 engine additive wave (続)。骨格凍結原則の **additive 例外** で
set-card-removal COST gate を解禁。前 wave (lvlDelta/stunChar、a206e9dc) と同流儀。全変更 additive
(既存カードは新 cost 未宣言 → 回帰0、smoke winsA=498 不変)。並行 card-session と engine/card 分離。
spec: `.claude/specs/engine-additive-removeset-cost-design.md`。

## 新 Cost kind `removeSetCard`

- 〚現場にいるキャラに裏向きでセットされているカードを合わせて n 枚リムーブする〛コスト
  (**B08033 工藤有希子** a2)。count-based の self-pool コスト (TargetingRef 不使用 — `candidates()` は
  set card を Candidate 列挙しない sub-entity ゆえ。`discardEvidence`/`removeDeckTop` と同型)。
- 公式 QA (B08033) を 1対1 反映: 相手カード不可 (self-only) / host 自身も数える / 「裏向き」(faceUp:false)
  のみ対象 / 分割可 (2キャラから1枚ずつ / 1キャラから2枚)。

## honor site (新 Cost kind の sync point)

- Cost union (`types/effect.ts`) / `canPay` (`cost/evaluate.ts`: self 全 scene の faceUp:false 総数 ≥ n +
  `COST_KIND_MAP`) / `pay` (`cost/pay.ts`: `costParams.removeSetCard.hostUids` 優先 → scene 順 fallback) /
  UI `costToText` / validate-specs `COSTS` whitelist + sync-test。
- cost-param channel: `AbilityCostParams.removeSetCard` + `costParamsToDyn` passthrough (`ability-activate.ts`)。
  AI/smoke は costParams 無 → pay の fallback (scene 順) で payable。interactive UI picker modal は
  card-session 出荷時の per-card 配線 (fallback で正しさ担保)。
- **self-only guard** (review concern #3): `pay` の explicit hostUids を自陣 scene の uid に filter
  (removeOneSetCard→findChar は両 scene 探索のため、誤って opp uid を渡しても相手 set card を外さない不変条件)。

## mutate `removeOneSetCard` opts 拡張 (additive)

- `opts?: { faceDownOnly?: boolean; cause?: 'effect'|'cost' }` を追加。default `{false,'effect'}` =
  既存 B08034 path 挙動を **完全保存** (回帰0、唯一の従来呼出元)。cost は `{faceDownOnly:true, cause:'cost'}`
  で faceUp:false の末尾 entry を splice、表向きでリムーブエリアへ + `setcard:leave` emit。

## hook 相互作用 (faithful)

- cost で自 set card 離場 → **B07034** 小泉紅子 (self側「裏向き set card が離れるたび draw」純 observer、
  ability/effect gate 無) が発火するのが正 (rules/21 の「自分の能力/効果」gate は当該 observer に無い、
  B07034 qa が多様な leave cause での発火を確認)。**B02020** 大岡紅葉 (opp側 trigger) は自 set card 離場では
  非発火。precedent: `removeFromScene` cost も `cause:'cost'` で leave hook emit。

## 検証 (additive ゲート)

- `tsc` 0 / 新テスト `tests/engine/cost-remove-set-card.test.ts` **14 pass** (canPay 4経路 + pay split/fallback/
  2-from-1/face-up除外 + B07034 E2E + pay-nest + mixed-pool canPay + opp-source + self-only guard) /
  `smoke:1000` winsA=498 不変 ex=0 baseline OK / eslint・8 lint 0err / validate-specs pass (PR280 fail は pre-existing 既知)。
- **opus 5 lens 敵対 review** (additivity / 完全性 / hook 忠実性 / test adequacy / edge-correctness) = **ship=true / BLOCKER 0**
  (4 no-blocker / 1 concern-only)。test-adequacy の medium concern 3件 (mixed-pool / opp-source / explicit self-ownership) を
  予防テスト + self-only guard で反映。残 concern は全て先行 sibling コスト共有の既知制約 or UI picker 未配線 (card-session 責務)。
- **B08033 a2 のコスト gate 解禁** (full ship は card-session certify: 登場時セット + a2 AP/突撃[キャラ]付与と併せ)。
