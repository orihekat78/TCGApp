### feat(engine): 小粒 additive 3件 — $self.stackedCount / discardRandom / removeCountAtLeast

- colorNot/handReveal と同方針 (純 additive・挙動不変・既存カード未使用) の engine 拡張 3件を engine-only 出荷。
  各々 1カードの blocked 句を完全解禁する。branch `engine/relative-ap-random-removal`。
- **`$self.stackedCount` dyn token** (`engine/dyn/eval.ts` resolveSelf): `scene.byUid(uid)?.stackedCards ?? 0`。
  session64 `$self.setCardCount` 同型の static field 読み (continuousDelta 再帰経路を踏まない)。
  → B06006 江戸川コナン a2「下に重なるカード1枚につき AP+1000」= `continuousModifier{apDelta:{dyn:'$self.stackedCount * 1000'}}`。
- **`discardRandom` atom verb** (`engine/effect/atom-handlers/core.ts` atomDiscardRandom): 手札を ctx.rng
  (無ければ Math.random、deck.shuffle と同式) で Fisher-Yates shuffle し先頭 k=min(n,len) を discardToRemove。
  **pick を持たない** (ランダム=プレイヤー選択不要) → awaiting-pick 経路なし。bind は discard 同型 (BUG-114)。
  → B01077「相手は手札を1枚ランダムにリムーブする」(公式QA=相手が選べず確率均等)。
- **`removeCountAtLeast` condition** (`engine/cond/eval.ts`): `remove.length >= n` (filter 無し total)。
  既存 removeColor/Trait/NameAtLeast の unfiltered 版。→ B03104「リムーブエリアにカードが15枚以上ある場合」
  (公式QA: 使用中イベント自身は remove 未配置で不算入 — 効果解決時点の盤面を読むため整合)。
- honor site 同期: AtomVerb union / validate.ts ATOM_VERB_MAP / atom-handlers dispatch / taskA-validate-specs.cjs VERBS
  (discardRandom)、Condition union / CONDITION_KIND_MAP / CONDS (removeCountAtLeast)。tsc exhaustive + sync-test が全 gate。
- 検証: 専用 test 13件 (stackedCount 4 / discardRandom 6 [境界・RNG決定性・重複cardId・player相対・空手札] / removeCountAtLeast 3) /
  tsc0 / full vitest 3305-pass-0-fail / smoke winsA=498 不変 (engine0) / 8lint errors=0 / opus 3-lens 敵対 review (worktree 直読)。
- stale 訂正: **B09096「同じAPのキャラ」relative-AP filter は engine変更0 と判明** (旧 DEFER「matchOneFilter literalize 経路なし」は誤り
  — `resolve-picks.ts resolveFilterDynObj` が field-agnostic で apMin/apMax {dyn:'$self.ap'} を列挙前に解決、probe 実証)。card session で出荷。
- ⚠ 出荷は engine 機構のみ。各カード本体 (B06006/B01077/B03104/B09096) は別 card session で authoring + Playwright human-path probe を経て出荷。
