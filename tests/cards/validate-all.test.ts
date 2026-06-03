// tests/cards/validate-all — Phase 5 Group F: 全 47 枚 validateAll
// spec: Phase 5 Task 5.7a
// rules: 02-deck-construction.md, 15-abilities-effects.md
//
// engine.cards.validateAll() を介して、registerAll() で投入される 47 枚すべてが
// 静的バリデーション (ability id 重複 / Effect DSL / ruleRefs 実在) を通過することを保証する。
//
// Phase 6 申し送り:
//   - D11019「15の受難」: a1 の sequence 内で AtomVerb 'deckShuffle' を使用。
//     `src/engine/types/effect.ts` と `atom-handlers.ts` には登録済みだが、
//     `src/engine/effect/validate.ts` の ATOM_VERBS 集合に未登録 (commit c68dd25 の wiring 漏れ)。
//     骨格凍結原則により本 Phase では修正せず、Group F でテストとして可視化する。
//     `KNOWN_FAILING_IDS` に列挙し、その他 46 枚が pass することを別検証で保証する。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll, GENERATED_PARTNERS } from '@/cards/index';

// MVP 47枚 baseline + generator 出力分を加算 (詳細は registry.test.ts)。
const GEN = GENERATED_PARTNERS.length;
const GEN_BLUE = GENERATED_PARTNERS.filter((c) => c.colors.includes('青')).length;
const GEN_YELLOW = GENERATED_PARTNERS.filter((c) => c.colors.includes('黄')).length;

/**
 * 既知の validator 漏れリスト。
 * Phase 5 完了時点で D11019 を含んでいたが、Phase 6 冒頭で validate.ts の ATOM_VERBS に
 * 'deckShuffle' を追加して解消。現在空。新たに validator が対応していない verb/condition を
 * 使うカードが追加された場合のみ、ここに id を追加すること。
 */
const KNOWN_FAILING_IDS = new Set<string>([]);

describe('engine.cards.validateAll — Phase 5 全47枚', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    registerAll();
  });

  it('全カード (MVP 47 + generated) が登録される', () => {
    expect(engine.cards.all().length).toBe(47 + GEN);
  });

  it('既知の失敗カード (KNOWN_FAILING_IDS) を除き、全カードが engine.cards.validate を通る (ok: true)', () => {
    const results = engine.cards.validateAll();
    const all = engine.cards.all();
    const failed = results
      .map((r, i) => ({ result: r, def: all[i] }))
      .filter((x): x is { result: { ok: false; errors: string[] }; def: typeof all[number] } => x.result.ok === false);

    // 既知失敗を除外
    const unexpected = failed.filter(f => !KNOWN_FAILING_IDS.has(f.def.id));

    if (unexpected.length > 0) {
      const messages = unexpected
        .map(f => `${f.def.id} ${f.def.names[0]}: ${f.result.errors.join('; ')}`)
        .join('\n');
      throw new Error(`Validation failed for ${unexpected.length} cards (unexpected):\n${messages}`);
    }
    expect(unexpected).toHaveLength(0);
  });

  it('KNOWN_FAILING_IDS に挙げたカードは確かに失敗する (regression guard)', () => {
    // Phase 6 で validator が修正されたらこのテストが赤化し、
    // KNOWN_FAILING_IDS から削除すべきことを通知する。
    const all = engine.cards.all();
    const results = engine.cards.validateAll();
    for (const id of KNOWN_FAILING_IDS) {
      const idx = all.findIndex(d => d.id === id);
      expect(idx, `KNOWN_FAILING_IDS contains ${id} but it is not registered`).toBeGreaterThanOrEqual(0);
      const r = results[idx];
      expect(r.ok, `${id} is in KNOWN_FAILING_IDS but now passes validation — remove from the list`).toBe(false);
    }
  });

  it('全カードの ruleRefs に記載されたファイルが実在する (Node only — validateRuleRefs)', async () => {
    // Phase 9-B hotfix: ruleRefs 実在チェックは validate-spec-files.ts (Node 専用) に分離。
    // validateAll (pure) は ruleRefs を見ないため、別途 validateRuleRefs を呼ぶ。
    const { validateRuleRefs } = await import('@/engine/effect/validate-spec-files');
    const all = engine.cards.all();
    const filtered = all.filter(d => !KNOWN_FAILING_IDS.has(d.id));
    const result = validateRuleRefs(filtered);
    const msg = result.ok === false ? result.errors.join('\n') : 'all refs exist';
    expect(result.ok, msg).toBe(true);
  });

  it('セット別カウント (CT-D08: 26, CT-D11: 21)', () => {
    const all = engine.cards.all();
    expect(all.filter(d => d.id.startsWith('D08')).length).toBe(26);
    expect(all.filter(d => d.id.startsWith('D11')).length).toBe(21);
  });

  it('色別カウント (青: 26 MVP + generated, 黄: 21 MVP + generated)', () => {
    const blue = engine.cards.byColor('青').length;
    const yellow = engine.cards.byColor('黄').length;
    expect(blue).toBe(26 + GEN_BLUE);
    expect(yellow).toBe(21 + GEN_YELLOW);
  });

  it('ability id は各カード内で一意', () => {
    const all = engine.cards.all();
    for (const def of all) {
      const ids = def.abilities.map(a => a.id);
      const unique = new Set(ids);
      expect(unique.size, `${def.id}: duplicate ability id detected`).toBe(ids.length);
    }
  });

  it('全 ability に description が存在 (空文字列でも OK)', () => {
    const all = engine.cards.all();
    for (const def of all) {
      for (const ab of def.abilities) {
        expect(typeof ab.description, `${def.id}.${ab.id}: description missing`).toBe('string');
      }
    }
  });
});
