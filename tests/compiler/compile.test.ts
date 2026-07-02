// Track B compiler — compile skeleton の単体テスト。
// 核心不変条件: 未知句 1 つでも card 全体 refuse (partial 変換禁止)。
import { describe, it, expect } from 'vitest';
const { compileCard, segment } = require('../../scripts/compiler/compile.cjs');

const entry = (texts: Record<string, string>, id = 'T001') => ({ id, kind: 'character', texts });

describe('compiler/compile (B0 skeleton)', () => {
  it('production 0 件: effect テキストを持つカードは refuse する', () => {
    const r = compileCard(entry({ effect: '【登場時】カードを1枚引く。' }), []);
    expect(r.status).toBe('refused');
    expect(r.refusals).toEqual([{ col: 'effect', text: '【登場時】カードを1枚引く。', reason: 'unknown-phrase' }]);
  });

  it('col11/12/13 (cutIn/hirameki/henso) も必ず句として拾う', () => {
    const r = compileCard(entry({ effect: '', cutIn: '', hirameki: '【ヒラメキ】カードを1枚引く。', henso: '' }), []);
    expect(r.status).toBe('refused');
    expect(r.refusals[0].col).toBe('hirameki');
  });

  it('全列空 (vanilla) は空 DSL に compile される', () => {
    const r = compileCard(entry({ effect: '', cutIn: '', hirameki: '', henso: '' }), []);
    expect(r.status).toBe('compiled');
    expect(r.abilities).toEqual([]);
    expect(r.keywords).toEqual([]);
  });

  it('一部の句だけ一致しても、未知句が残れば card 全体 refuse (partial 変換禁止)', () => {
    const rule = {
      name: 'test-effect-only',
      match: (seg: { col: string }) => seg.col === 'effect',
      emit: () => ({ abilities: [{ type: 'triggered' }] }),
    };
    const r = compileCard(entry({ effect: '既知句。', hirameki: '未知句。' }), [rule]);
    expect(r.status).toBe('refused');
    expect(r.refusals).toEqual([{ col: 'hirameki', text: '未知句。', reason: 'unknown-phrase' }]);
  });

  it('全句一致なら emit が合成される', () => {
    const rules = [
      { name: 'eff', match: (s: { col: string }) => s.col === 'effect', emit: () => ({ abilities: [{ type: 'triggered' }], keywords: ['突撃'] }) },
      { name: 'hira', match: (s: { col: string }) => s.col === 'hirameki', emit: () => ({ abilities: [{ type: 'icon-hirameki' }] }) },
    ];
    const r = compileCard(entry({ effect: 'A。', hirameki: 'B。' }), rules);
    expect(r.status).toBe('compiled');
    expect(r.abilities).toEqual([{ type: 'triggered' }, { type: 'icon-hirameki' }]);
    expect(r.keywords).toEqual(['突撃']);
  });

  it('segment は空白のみの列を句にしない', () => {
    expect(segment({ effect: '  ', cutIn: 'X' })).toEqual([{ col: 'cutIn', text: 'X' }]);
  });
});
