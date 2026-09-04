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
    expect(html).toMatch(/data-orientation="portrait"/);
    expect(html).toMatch(/class="case-title">テスト事件</);
    // Round 2: EVT・色 と Lv 表記は冗長としてユーザ指摘を受けて削除済。
    // 旧 case-stamp は削除し、状態は事件ヘッダー内に所有させる。
    expect(html).not.toMatch(/EVT・/);
    expect(html).not.toMatch(/case-lv/);
    expect(html).not.toMatch(/case-stamp/);
    expect(html).toMatch(/必要証拠 <strong>7<\/strong>（先攻）/);
  });

  it('renders landscape case card when orientation="landscape" (Phase 8.5)', () => {
    const html = strip(renderToString(
      <CaseArea
        caseInfo={makeCase({ orientation: 'landscape' })}
        turnOrder="first"
        side="self"
      />,
    ));
    expect(html).toMatch(/class="case-card landscape color-blue"/);
    expect(html).toMatch(/data-orientation="landscape"/);
    expect(html).not.toMatch(/case-card portrait/);
  });

  it.each(['portrait', 'landscape'] as const)(
    'keeps the %s card detail control in a dedicated sibling lane',
    (orientation) => {
      const html = strip(renderToString(
        <CaseArea
          caseInfo={makeCase({ orientation })}
          turnOrder="first"
          side="self"
          onExpand={() => undefined}
        />,
      ));

      expect(html).toMatch(/class="case-card-shell"/);
      expect(html).toMatch(/<\/div><button[^>]*class="case-card-detail"/);
    },
  );

  it('gives the whole incident area to candidate selection instead of rendering the detail control', () => {
    const html = strip(renderToString(
      <CaseArea
        caseInfo={makeCase()}
        turnOrder="first"
        side="self"
        isCandidate
        onClick={() => undefined}
        onExpand={() => undefined}
      />,
    ));

    expect(html).toMatch(/case-area--candidate/);
    expect(html).not.toMatch(/case-card-detail/);
  });

  it('defaults to portrait orientation when caseInfo.orientation is undefined', () => {
    const html = strip(renderToString(
      <CaseArea caseInfo={makeCase()} turnOrder="first" side="self" />,
    ));
    // makeCase() does not set orientation → portrait
    expect(html).toMatch(/data-orientation="portrait"/);
  });

  it('解決編の状態を事件ヘッダー内で所有する', () => {
    const html = strip(renderToString(
      <CaseArea
        caseInfo={makeCase({ status: '解決編' })}
        turnOrder="first"
        side="self"
      />,
    ));
    expect(html).not.toMatch(/case-stamp/);
    expect(html).toMatch(/zone-label[\s\S]*case-edition-tag resolved/);
    expect(html).toMatch(/aria-label="事件状態: 解決編"/);
    expect(html).toMatch(/>解決編<\/span>/);
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
      // Round 2: EVT・色 表記は削除されたため、color class のみで確認
      // (label 引数は将来の use case のため残す)
      void label;
    }
  });
});
