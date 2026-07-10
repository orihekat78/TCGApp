// refactor 2b (2026-06-12): 手動同期ペアの機械検証
// spec: .claude/specs/refactor-plan/phases.md §2b
//
// engine 側の単一ソース (TS union と `satisfies Record<…, true>` でコンパイル時同期済の
// value セット) と、scripts/taskA-validate-specs.cjs の whitelist (cjs は TS の型を参照
// できないため独立に列挙されている) のズレを検出する。
// Task D wave#1 で「新 verb/cond 追加時に cjs whitelist の同期を忘れる」事故が確認された
// ため (NEXT-SESSION-PROMPT 注意事項)、本テストが full vitest / pre-commit で再発を防ぐ。
//
// 同期規則:
// - VERBS ∪ FORBIDDEN_VERBS = ATOM_VERBS (charSetAP 等の throw stub は taskA で禁止)
// - HOOKS = TRIGGERED_HOOKS (card-triggerable hook 全部)
// - CONDS = CONDITION_KINDS − {custom} (custom は JSON 不能なので spec 禁止)
// - COSTS = COST_KINDS − {custom} (同上)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ATOM_VERBS } from '@/engine/effect/validate';
import { COST_KINDS } from '@/engine/cost/evaluate';
import { CONDITION_KINDS } from '@/engine/cond/eval';
import { TRIGGERED_HOOKS } from '@/engine/listeners/triggered';
import type { TargetFilter } from '@/engine/types/effect';

// wave#2 cluster2 (2026-06-12): FILTER_FIELDS の同期検証。TargetFilter は型のみで engine に
// runtime キー一覧が無いため、ここで satisfies によりコンパイル時同期した value セットを定義する。
// TargetFilter にキーを追加/削除するとこの literal が typecheck で落ち、cjs FILTER_FIELDS の
// 更新を強制する (従来は同期テスト対象外で更新漏れを CI が検知できなかった)。
const TARGET_FILTER_KEYS = {
  cardId: true, cardName: true, cardNameNot: true, trait: true, color: true, colorNot: true, keyword: true,
  kind: true, apMin: true, apMax: true, lpMin: true, lpMax: true,
  baseLpMin: true, baseLpMax: true, // Cluster WB1 (2026-07-11, B09011): 元LP (override 単体) 軸
  levelMin: true, levelMax: true, hasSetCards: true,
  actedCharThisTurn: true, // engine additive wave-7 (2026-07-02, P17)
  hasFaceDownSetCards: true, // engine mega-wave W4 (2026-07-03, r82 同梱): 裏向きセット保持軸 (B08035 a2)
  levelIn: true, levelInBound: true, // engine mega-wave W5 (2026-07-04, r47): bound 集合 level any-match (B04074)
  shippuFiredCharThisTurn: true, // engine mega-wave W6 step4 (2026-07-04, r58): 疾風発動 per-char 軸 (B09070)
  cutinTextIncludes: true, // M2後半 (2026-07-10): cutin 効果内容 filter (D06003 family、qAndA 文字列包含)
} as const satisfies Record<Exclude<keyof TargetFilter, 'custom'>, true>;

const cjsSource = readFileSync(
  resolve(__dirname, '../../scripts/taskA-validate-specs.cjs'),
  'utf-8',
);

/** cjs から `const NAME = new Set([...])` の文字列要素を抽出する */
function extractSet(name: string): Set<string> {
  const m = cjsSource.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) throw new Error(`taskA-validate-specs.cjs に const ${name} = new Set([...]) が見つからない`);
  const items = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  if (items.length === 0) throw new Error(`${name} の要素抽出が 0 件`);
  return new Set(items);
}

function sortedDiff(a: ReadonlySet<string>, b: ReadonlySet<string>): { onlyA: string[]; onlyB: string[] } {
  return {
    onlyA: [...a].filter(x => !b.has(x)).sort(),
    onlyB: [...b].filter(x => !a.has(x)).sort(),
  };
}

describe('taskA-validate-specs.cjs whitelist ↔ engine 単一ソースの同期 (refactor 2b)', () => {
  it('VERBS ∪ FORBIDDEN_VERBS = AtomVerb union (validate.ts ATOM_VERBS)', () => {
    const verbs = extractSet('VERBS');
    const forbidden = extractSet('FORBIDDEN_VERBS');
    for (const f of forbidden) {
      expect(verbs.has(f), `FORBIDDEN_VERBS の '${f}' が VERBS にも居る (重複)`).toBe(false);
    }
    const union = new Set([...verbs, ...forbidden]);
    expect(sortedDiff(union, ATOM_VERBS)).toEqual({ onlyA: [], onlyB: [] });
  });

  it('FILTER_FIELDS = TargetFilter keys − {custom} (wave#2 cluster2)', () => {
    const fields = extractSet('FILTER_FIELDS');
    expect(sortedDiff(fields, new Set(Object.keys(TARGET_FILTER_KEYS)))).toEqual({ onlyA: [], onlyB: [] });
  });

  it('HOOKS = TRIGGERED_HOOKS (listeners/triggered.ts)', () => {
    const hooks = extractSet('HOOKS');
    expect(sortedDiff(hooks, new Set(TRIGGERED_HOOKS))).toEqual({ onlyA: [], onlyB: [] });
  });

  it("CONDS = Condition union − {custom} (cond/eval.ts CONDITION_KINDS)", () => {
    const conds = extractSet('CONDS');
    const expected = new Set([...CONDITION_KINDS].filter(k => k !== 'custom'));
    expect(sortedDiff(conds, expected)).toEqual({ onlyA: [], onlyB: [] });
  });

  it("COSTS = Cost union − {custom} (cost/evaluate.ts COST_KINDS)", () => {
    const costs = extractSet('COSTS');
    const expected = new Set([...COST_KINDS].filter(k => k !== 'custom'));
    expect(sortedDiff(costs, expected)).toEqual({ onlyA: [], onlyB: [] });
  });
});
