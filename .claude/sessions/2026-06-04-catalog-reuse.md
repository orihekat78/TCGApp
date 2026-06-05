# 2026-06-04 catalog-reuse バッチ (非MVP・既存engine流用カード実装)

## 目的
`.claude/specs/cards-data` の未実装カードのうち **card-condition-catalog.md の既存 condition + 既存 atom verb + 既存共通クラス + 配線済 hook だけで完全実装できる** ものを骨格無改変で実装。
※「単純カード213枚 (simple cutin / keyword-only / case no-ability)」は別セッション担当のため対象外。

## 成果
- **172 cardId / 262 ファイル実装** (90 が絵柄違い variant spread)。`src/cards/_reuse/index.ts` (`REUSE_CARDS`) に集約 → registry へ配線。
- 19 パッケージ横断 (ct-d01〜d10 / ct-p01〜p09 / pr-01)。kind: character 208 / event 29 / case 25 (ファイル基準)。
- `ALL_CARDS` 572 → **834** (他session simple 572 + 本 262)、**id 重複 0**・**validate 失敗 0**。

## 検証 (全 green)
- `npx tsc --noEmit` = **0 error** (262 ファイル型正)。
- `engine.cards.validate` 全 834 枚 **0 invalid / 0 dup-id** (`scripts/reuse-registry-check.ts`)。
- `npx vitest run` = **224 file pass / 1713 test pass** (count test に `REUSE_CARDS` 加算、`tests/cards/reuse-batch.test.ts` 追加)。
- **敵対的 rules-correctness レビュー** 172 base 全件 (15 agent)。162 clean + 10 "wrong" flag → **全件 false-positive と裁定** (根拠下記)、**真のバグ 0**。

## レビュー flag 裁定 (全 false-positive)
- 「短縮形でなく explicit target:pick にすべき」(0053/0181/0951 等) → 規約 §3 で短縮形が **推奨**。ATOM_PICK_SPEC が sceneRemove/charModifyAP/sceneSetState/charGrantKeyword を Pattern A 対応。
- ヒラメキの choice+explicit-target (0079/1042) → D08019 a2 同型で **正** (hirameki fire は short-form auto-pick 不可)。
- 0321「【自分ターン中】gate 欠落」→ 実際は `and{partnerColor赤, turn:self}` で **存在** (誤検知)。
- 0082「コスト7以下」→ rules/28 エラッタ `levelMax:7` で **正対応**済。
- buff の `side:'either'` (0076/0082) → rules/15「指定なき『キャラを選び』=どちらの現場も選択可」。text に「自分の現場」明記なき限り either が **rules 忠実** (推測補完しない)。
- 0356 `player:'self', side:'opp'` → controller=self / 対象=相手現場で **正**。conditional{if sceneHas self≥5, then remove, else stun} で「代わりに」も忠実。

## 手法 (workflow orchestration)
1. **分類** 914 cardId を 37 batch で reusable/blocked/uncertain 判定 → 485 reusable。
2. **実装** 35 batch (pilot 4 → 残り 31)。各 agent が IMPL-GUIDE の **配線済 hook whitelist + ハード blocker** で **self-gate** (1clause でも whitelist 外なら DEFER / 部分実装禁止)。
3. **central verify** barrel scan (`catalog-reuse batch` マーカ) → typecheck/validate/dedup。
4. **adversarial review** 15 agent → 裁定。

## DEFER 内訳 (485 reusable のうち 311 を impl 時に DEFER)
impl agent が classification より厳格 gate (false-positive 排除)。主 blocker = engine 未対応:
- 【現場リムーブ時】/leave hook 未配線・contact-removal hook 未配線・state-change トリガ未配線
- charModifyLevel 無し・look-top-N-then-select 無し・sceneEnter 手札限定 (リムーブ/デッキ起点不可)
- 他キャラへのオーラ buff (continuousModifier 自キャラ限定)・untargetable 無し・multi-target AP 修正不可
- 単一 pick → 複数効果の bind 不可・hand-size/self-AP 参照 condition 無し・任意テキスト能力付与不可

→ これらは **骨格凍結原則** により実装せず一覧化 (engine 拡張すれば実装可能な将来候補)。
全 blocker 集計: `.tmp/reuse/` (worklist.json / reusable-full.json / cls/ / 各 workflow deferredList)。

## 残課題
- classification parse 失敗 63 cardId (c22 bad-escape 等) は未分類 → 再分類すれば追加実装候補。
- 本バッチは **構造検証 + rules レビュー** 済だが **個別 playtest 未実施** (generator batch 213 と同基準)。smoke は MVP デッキのみのため非MVP カード未踏。
- registry/index.ts・count test は他session と共有 → commit 時 conflict 注意 (append-only 編集で最小化)。
