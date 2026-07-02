// Track B compiler — mine.cjs (採掘器) の単体テスト。
// 敵対 review (2026-07-02) BLOCKER の回帰ガードを含む:
//   「refuse する card から採掘した消去法 (elim) rule は composition 検証を受けないまま出荷される」
//   → purgeLoop が「match 済 exemplar を 1 枚も持たない elim rule」を全て除去することを合成 fixture で pin。
import { describe, it, expect } from 'vitest';
const { mineAll, purgeLoop, productionFromRuleMap } = require('../../scripts/compiler/mine.cjs');
const { runOracle } = require('../../scripts/compiler/oracle.cjs');

const entry = (id: string, texts: Record<string, string>, kind = 'character') => ({
  id,
  kind,
  texts: { effect: '', cutIn: '', hirameki: '', henso: '', ...texts },
});

describe('compiler/mine (synthetic fixtures)', () => {
  it('desc 突合で採掘した rule は他カードの compile に再利用される', () => {
    const corpus = [entry('C1', { effect: '甲。' }), entry('C2', { effect: '甲。' })];
    const shipped = [
      { id: 'C1', keywords: [], abilities: [{ type: 'triggered', description: '甲。', effect: { kind: 'atom', verb: 'draw' } }] },
      { id: 'C2', keywords: [], abilities: [{ type: 'triggered', description: '甲。', effect: { kind: 'atom', verb: 'draw' } }] },
    ];
    const { ruleMap, conflicts } = mineAll(corpus, shipped);
    expect(conflicts.size).toBe(0);
    const { dry } = purgeLoop(corpus, shipped, ruleMap);
    expect(dry.totals.match).toBe(2);
    expect(dry.totals.mismatch).toBe(0);
  });

  it('同一 key に異なる意味 → conflict として rule 化拒否 (refuse-first)', () => {
    const corpus = [entry('C1', { effect: '乙。' }), entry('C2', { effect: '乙。' })];
    const shipped = [
      { id: 'C1', keywords: [], abilities: [{ type: 'triggered', description: '乙。', effect: { kind: 'atom', verb: 'draw' } }] },
      { id: 'C2', keywords: [], abilities: [{ type: 'continuous', description: '乙。', continuousModifier: { apDelta: 1000 } }] },
    ];
    const { ruleMap, conflicts } = mineAll(corpus, shipped);
    expect(conflicts.size).toBe(1);
    expect(ruleMap.size).toBe(0);
  });

  it('BLOCKER 回帰: refuse する card 由来の未検証 elim rule は purge される (幻 rule の構造排除)', () => {
    // card A: effect 2 行は desc パラフレーズ (elim pairing でしか採掘できない) + closure ヒラメキ行
    //   → A 自身は closure 行で必ず refuse = elim pairing は composition 検証を一度も受けない
    const corpus = [entry('A1', { effect: '丙。\\n丁。', hirameki: '【ヒラメキ】戊。' })];
    const shipped = [
      {
        id: 'A1',
        keywords: [],
        abilities: [
          { type: 'triggered', description: '要約表記の丙', effect: { kind: 'atom', verb: 'draw' } },
          { type: 'continuous', description: '要約表記の丁', continuousModifier: { apDelta: 1000 } },
          { type: 'triggered', description: '【ヒラメキ】戊。', effect: { kind: 'atom', verb: 'x' }, matcher: '<closure>' },
        ],
      },
    ];
    const { ruleMap } = mineAll(corpus, shipped);
    expect(ruleMap.size).toBe(2); // elim 2 rule が一旦は採掘される
    const { dry, purgedTotal } = purgeLoop(corpus, shipped, ruleMap);
    expect(purgedTotal).toBe(2); // match 済 exemplar を持たない elim rule は全て除去
    expect(ruleMap.size).toBe(0);
    expect(dry.totals.match).toBe(0); // A1 は refuse (safe)
    expect(dry.totals.mismatch).toBe(0);
  });

  it('match で検証された elim rule は残る (正当な消去法 pairing)', () => {
    const corpus = [entry('B1', { effect: '己。' })];
    const shipped = [
      { id: 'B1', keywords: [], abilities: [{ type: 'triggered', description: '要約表記の己', effect: { kind: 'atom', verb: 'draw' } }] },
    ];
    const { ruleMap } = mineAll(corpus, shipped);
    const { dry, purgedTotal } = purgeLoop(corpus, shipped, ruleMap);
    expect(purgedTotal).toBe(0);
    expect(ruleMap.size).toBe(1);
    expect(dry.totals.match).toBe(1);
    // 採掘済 rule で未実装カード (同一行) が compile できる
    const rep = runOracle([...corpus, entry('B2', { effect: '己。' })], shipped, [productionFromRuleMap(ruleMap)]);
    expect(rep.totals.unshippedCompiled).toBe(1);
  });
});
