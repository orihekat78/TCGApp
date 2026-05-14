// Phase 7 Task 7.6: CaseArea tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CaseArea, type CaseInfo } from '@/ui/components/CaseArea';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

function makeCase(overrides: Partial<CaseInfo> = {}): CaseInfo {
  return {
    cardId: 'CASE-001',
    title: 'テスト事件',
    color: 'blue',
    level: 7,
    status: '事件編',
    requiredEvidence: 7,
    ...overrides,
  };
}

describe('CaseArea', () => {
  it('renders empty placeholder when caseInfo is null', () => {
    const html = strip(renderToString(
      <CaseArea caseInfo={null} turnOrder="first" side="self" />,
    ));
    expect(html).toMatch(/case-area side-self/);
    expect(html).toMatch(/<span>事件<\/span>/);
    expect(html).toMatch(/class="case-empty"[^>]*aria-label="事件未開始">未開始/);
    expect(html).not.toMatch(/class="case-card /);
    expect(html).not.toMatch(/case-stamp/);
  });

  it('renders portrait case card with title / meta / stamp / required-evidence', () => {
    const html = strip(renderToString(
      <CaseArea caseInfo={makeCase()} turnOrder="first" side="self" />,
    ));
    expect(html).toMatch(/class="case-card portrait color-blue"/);
    expect(html).toMatch(/data-card-id="CASE-001"/);
    expect(html).toMatch(/class="case-title">テスト事件</);
    expect(html).toMatch(/EVT・青/);
    expect(html).toMatch(/class="case-lv">Lv 7</);
    expect(html).toMatch(/class="case-stamp">事件編</);
    expect(html).toMatch(/必要証拠 <strong>7<\/strong>（先攻）/);
  });

  it('applies .resolved class to stamp when status is 解決編', () => {
    const html = strip(renderToString(
      <CaseArea
        caseInfo={makeCase({ status: '解決編' })}
        turnOrder="first"
        side="self"
      />,
    ));
    expect(html).toMatch(/class="case-stamp resolved">解決編</);
  });

  it('shows 後攻 + 必要証拠 6 when turnOrder is second', () => {
    const html = strip(renderToString(
      <CaseArea
        caseInfo={makeCase({ requiredEvidence: 6 })}
        turnOrder="second"
        side="self"
      />,
    ));
    expect(html).toMatch(/必要証拠 <strong>6<\/strong>（後攻）/);
  });

  it('renders <br /> when title contains \\n', () => {
    const html = strip(renderToString(
      <CaseArea
        caseInfo={makeCase({ title: '月光に潜む\n古城の影' })}
        turnOrder="first"
        side="self"
      />,
    ));
    // タイトルが <br> で 2 行に分割される
    expect(html).toMatch(/月光に潜む<br\/>古城の影/);
  });

  it('applies side-opp class for opponent and opp data attribute', () => {
    const html = strip(renderToString(
      <CaseArea caseInfo={makeCase()} turnOrder="second" side="opp" />,
    ));
    expect(html).toMatch(/case-area side-opp/);
    expect(html).toMatch(/data-side="opp"/);
    expect(html).toMatch(/data-turn-order="second"/);
  });

  it('renders all 5 colors with corresponding label', () => {
    const cases: Array<[CaseInfo['color'], string]> = [
      ['blue', '青'], ['yellow', '黄'], ['red', '赤'],
      ['green', '緑'], ['purple', '紫'],
    ];
    for (const [color, label] of cases) {
      const html = strip(renderToString(
        <CaseArea
          caseInfo={makeCase({ color })}
          turnOrder="first"
          side="self"
        />,
      ));
      expect(html).toMatch(new RegExp(`color-${color}`));
      expect(html).toMatch(new RegExp(`EVT・${label}`));
    }
  });
});
