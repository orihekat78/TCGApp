// Track B compiler — compile skeleton の単体テスト。
// 核心不変条件: 未知句 1 つでも card 全体 refuse (partial 変換禁止)。
import { describe, it, expect } from 'vitest';
const { compileCard, segment } = require('../../scripts/compiler/compile.cjs');

const entry = (texts: Record<string, string>, id = 'T001') => ({ id, kind: 'character', texts });

describe('compiler/compile (B0 skeleton)', () => {
  it('パートナー共通能力は標準FILE 7とPR022のFILE 8だけを定型文として受理する', () => {
    const partner = (threshold: number) => ({
      id: threshold === 8 ? 'PR022' : 'B01001',
      kind: 'partner',
      texts: {
        effect: `【解決編】【事件解決】【スリープ】：自分の証拠が事件レベルの数以上ある場合、ゲームに勝利する。\\n【アシスト】【スリープ】：FILEエリアに移動する。自分のFILEエリアにカードが${threshold}枚以上ある場合、事件を解決編にする。`,
      },
    });

    expect(compileCard(partner(7))).toMatchObject({ status: 'compiled', abilities: [] });
    expect(compileCard(partner(8))).toMatchObject({ status: 'compiled', abilities: [] });
    expect(compileCard(partner(9))).toMatchObject({
      status: 'refused',
      refusals: [{ reason: 'unknown-phrase' }],
    });
  });

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

  it('segment は列を印字行 (literal \\n) に分割する', () => {
    expect(segment({ effect: 'A。\\nB。' })).toEqual([
      { col: 'effect', text: 'A。' },
      { col: 'effect', text: 'B。' },
    ]);
  });

  it('colspan rule (列全体 = 複数行 1 能力) は行 rule より先に試される', () => {
    const colRule = {
      name: 'span',
      match: (s: { col: string; colSpan?: boolean }) => !!s.colSpan && s.col === 'cutIn',
      emit: () => ({ abilities: [{ type: 'triggered', note: 'span' }] }),
    };
    const r = compileCard(entry({ cutIn: '【カットイン】A\\n【相手ターン中】B' }), [colRule]);
    expect(r.status).toBe('compiled');
    expect(r.abilities).toEqual([{ type: 'triggered', note: 'span' }]);
  });

  it('colspan rule が無い列は行単位で照合され、未知行は card 全体 refuse', () => {
    const lineRule = {
      name: 'line-a',
      match: (s: { text: string; colSpan?: boolean }) => !s.colSpan && s.text === 'A。',
      emit: () => ({ abilities: [{ type: 'triggered' }] }),
    };
    const r = compileCard(entry({ effect: 'A。\\n未知行。' }), [lineRule]);
    expect(r.status).toBe('refused');
    expect(r.refusals).toEqual([{ col: 'effect', text: '未知行。', reason: 'unknown-phrase' }]);
  });

  it('refuseEntry rule は card 単位で恒久 refuse する (例外リスト)', () => {
    const exc = { name: 'exc', refuseEntry: (e: { id: string }) => (e.id === 'T001' ? '理由X' : false) };
    const r = compileCard(entry({ effect: 'A。' }), [exc]);
    expect(r.status).toBe('refused');
    expect(r.refusals[0].reason).toBe('理由X');
  });
});
