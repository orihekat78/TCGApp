// Track B compiler — oracle 3 値判定の単体テスト。
import { describe, it, expect } from 'vitest';
const { runOracle, judge, baseId } = require('../../scripts/compiler/oracle.cjs');

const entry = (id: string, effect: string) => ({ id, kind: 'character', texts: { effect, cutIn: '', hirameki: '', henso: '' } });
const shipped = (id: string, abilities: unknown[] = [], keywords: string[] = []) => ({ id, abilities, keywords });

describe('compiler/oracle', () => {
  it('baseId は P variant を base printing に写す', () => {
    expect(baseId('B08004P')).toBe('B08004');
    expect(baseId('B05005P1')).toBe('B05005');
    expect(baseId('D08001')).toBe('D08001');
  });

  it('refuse: 未知句カードは refuse 判定', () => {
    const r = judge(entry('X1', '未知のテキスト。'), shipped('X1'), []);
    expect(r.verdict).toBe('refuse');
  });

  it('match: compile 結果が shipped と構造一致 (key 順の違いは吸収)', () => {
    const rule = { name: 'r', match: () => true, emit: () => ({ abilities: [{ type: 'triggered', scope: 'on-scene' }] }) };
    const r = judge(entry('X1', 'テキスト。'), shipped('X1', [{ scope: 'on-scene', type: 'triggered' }]), [rule]);
    expect(r.verdict).toBe('match');
  });

  it('mismatch: compile 成功したが shipped と不一致 = silent 誤訳として顕在化', () => {
    const rule = { name: 'r', match: () => true, emit: () => ({ abilities: [{ type: 'continuous' }] }) };
    const r = judge(entry('X1', 'テキスト。'), shipped('X1', [{ type: 'triggered' }]), [rule]);
    expect(r.verdict).toBe('mismatch');
  });

  it('vanilla: 全列空 + shipped abilities/keywords 空 → match', () => {
    const r = judge(entry('X1', ''), shipped('X1'), []);
    expect(r.verdict).toBe('match');
  });

  it('runOracle: P variant は base corpus 行で判定し、corpus 不在は noCorpus に隔離', () => {
    const corpus = [entry('B99001', '未知。')];
    const sh = [shipped('B99001'), shipped('B99001P'), shipped('ZZZZZ')];
    const rep = runOracle(corpus, sh, []);
    expect(rep.totals.refuse).toBe(2); // base + P variant とも refuse
    expect(rep.buckets.noCorpus).toEqual(['ZZZZZ']);
    expect(rep.totals.judged + rep.totals.noCorpus).toBe(3);
  });

  it('runOracle: refuse 理由の列別ヒストグラムを集計する', () => {
    const corpus = [entry('A1', '未知。'), entry('A2', '未知。')];
    const rep = runOracle(corpus, [shipped('A1'), shipped('A2')], []);
    expect(rep.refuseReasons['effect:unknown-phrase']).toBe(2);
  });
});
