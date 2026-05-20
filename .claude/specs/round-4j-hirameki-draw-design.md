---
name: round-4j-hirameki-draw-design
date: 2026-05-20
round: 4j
status: design
related:
  - .claude/specs/shared-classes/hiramekiDraw.md
  - tests/e2e/patterns/event-remove-by-ap.spec.ts
  - .claude/bugs/BUG-034.md
---

# Round 4j — hiramekiDraw E2E spec 設計

## 対象カード
- **D08013 a2 (character / 青 Lv4 / 吉田歩美)**: `hiramekiDraw({ n:1, abilityId:'a2' })`
- **D08024 a2 (event / 青 Lv6)**: `hiramekiDraw({ n:1, abilityId:'a2' })` (a1 は Round 4i-fix で selfOnly 追加済)

`hiramekiDraw` factory ([src/cards/_shared/hiramekiDraw.ts](../../src/cards/_shared/hiramekiDraw.ts)) は `type:'icon-flash'`、`scope:'on-evidence'`、effect = atom-draw。

## ファイル
- 新規: `tests/e2e/patterns/hirameki-draw.spec.ts` (≤220 LOC、template = event-remove-by-ap.spec.ts)

## 検証層 (Round 4j 限定スコープ)

1. **shape**: `ability.type === 'icon-flash'`、`scope === 'on-evidence'`、`effect.kind === 'atom'`、`verb === 'draw'`、`args.n === 1`、`args.player === 'self'`
2. **negative**: 非 hirameki カード (D08015) は abilities に `type:'icon-flash'` を含まない

合計 3 tests (2 shape + 1 negative)。

## ⚠️ Round 4j 限定スコープの理由 (BUG-034)

action[case] dispatch → `pendingHirameki` populate の **実機検証は本 spec から除外**。

実装中に **vite dev mode で hirameki side-channel が dispatch 経路から store に反映されない bug** を検出 → `.claude/bugs/BUG-034.md` 登録。

- jsdom (`tests/integration/hirameki-e2e.test.ts`) は **正常動作** (5 PASS、本番ロジック自体は正しい)
- vite dev mode では `_pendingHiramekiSideChannel` の module instance 分離疑い (`@/engine/listeners/hirameki.js` vs `./listeners/hirameki.js` の resolve 差)
- BUG-034 fix 後に Round 4j-fix で **元の 7 test 構成** (shape + fire + skip + negative × 2 カード) に拡張予定

## 共通パターン spec 進捗

| # | パターン | spec | round |
|---|---|---|---|
| 1 | cutinFixedAP | cutin-fixed-ap.spec.ts | 4e |
| 2 | partnerColorKeyword | partner-color-keyword.spec.ts | 4f |
| 3 | caseTraitConditioned | case-trait-conditioned.spec.ts | 4h |
| 4 | eventRemoveByAP | event-remove-by-ap.spec.ts | 4i + 4i-fix |
| 5 | **hiramekiDraw** | **hirameki-draw.spec.ts (shape only)** | **4j** |
| (5 拡張) | hiramekiDraw fire/skip | (Round 4j-fix で追加予定) | 4j-fix |
| (将来) | hiramekiCharStun | hirameki-char-stun.spec.ts | 4k |

→ 共通パターン spec **5/5 完了** (shape verification ベース)

## 完了条件
1. typecheck clean / docs:check clean
2. unit 1467 PASS + 1 skipped (回帰なし)
3. E2E 24 → 27 PASS + 1 skipped (3 新規追加)
4. smoke 525/475 baseline 完全維持
5. BUG-034 登録 (修正は Round 4j-fix)
6. session log + spec doc + README + memory 整備

## commit
`test(e2e),docs(bugs): Round 4j — hiramekiDraw 2 カード shape E2E + BUG-034 (vite module isolation) 登録 + 共通パターン spec 5/5`
