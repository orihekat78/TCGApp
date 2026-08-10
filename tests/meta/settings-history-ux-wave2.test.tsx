import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryScreen } from '../../meta-app/src/screens/HistoryScreen';
import { SettingsScreen } from '../../meta-app/src/screens/SettingsScreen';
import { MetaShell } from '../../meta-app/src/MetaShell';
import { useHistoryStore } from '../../meta-app/src/state/historyStore';
import { normalizeSettings, useMetaStore } from '../../meta-app/src/state/metaStore';

describe('Wave 2 settings and history recovery', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    localStorage.clear();
    useHistoryStore.setState({ history: [], _hasHydrated: true });
    useMetaStore.setState({ settings: normalizeSettings(null), _hasHydrated: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it('offers an empty-history recovery action with a 44px minimum target', () => {
    const onNav = vi.fn();
    act(() => root.render(<HistoryScreen onNav={onNav} />));

    const cta = container.querySelector<HTMLButtonElement>('.history-content .meta-btn-small');
    expect(cta).not.toBeNull();
    act(() => cta!.click());
    expect(onNav).toHaveBeenCalledWith('setup');

    const css = readFileSync('meta-app/src/screens/HistoryScreen.css', 'utf8');
    expect(css).toMatch(/\.history-content \.meta-btn-small[\s\S]*min-width:\s*44px/);
    expect(css).toMatch(/\.history-content \.meta-btn-small[\s\S]*min-height:\s*44px/);
  });

  it('keeps observed games neutral and excludes them from player win and loss filters', () => {
    useHistoryStore.setState({ history: [{
      id: 'observe-1', recorded: 1, won: true, deckName: 'CPU 1', oppDeckName: 'CPU 2', mode: 'observe',
      turns: 4, duration: 0, evidGot: 0, evidLost: 0, contacts: 0, hirameki: 0, misread: 0, p1Target: 7, p2Target: 7,
    }] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));

    expect(container.querySelector('tbody')?.textContent).toContain('CPU 1');
    expect(useHistoryStore.getState().winRate()).toEqual({ rate: 0, wins: 0, total: 0 });
    const filters = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-pressed]'));
    act(() => filters[1].click());
    expect(container.querySelector('table')).toBeNull();
    act(() => filters[2].click());
    expect(container.querySelector('table')).toBeNull();
  });

  it('keeps segmented changes in a local draft until the user explicitly saves', () => {
    useMetaStore.setState({
      settings: normalizeSettings({ density: 'comfortable', presentationSpeed: 'standard', spectatorAi: 'standard' }),
    });
    act(() => root.render(<SettingsScreen onNav={() => undefined} />));

    const segmented = container.querySelectorAll<HTMLElement>('.settings-segmented');
    act(() => segmented[0].querySelectorAll<HTMLButtonElement>('button')[0].click());
    act(() => segmented[1].querySelectorAll<HTMLButtonElement>('button')[2].click());
    act(() => segmented[2].querySelectorAll<HTMLButtonElement>('button')[0].click());

    const status = container.querySelector<HTMLElement>('[role="status"]');
    expect(status?.textContent).toBe('未保存の変更があります。');
    expect(useMetaStore.getState().settings).toMatchObject({
      density: 'comfortable', presentationSpeed: 'standard', spectatorAi: 'standard',
    });
    expect(segmented[0].querySelectorAll('button')[0].getAttribute('aria-pressed')).toBe('true');
    expect(segmented[1].querySelectorAll('button')[2].getAttribute('aria-pressed')).toBe('true');
    expect(segmented[2].querySelectorAll('button')[0].getAttribute('aria-pressed')).toBe('true');

    const save = container.querySelector<HTMLButtonElement>('.settings-save');
    expect(save).not.toBeNull();
    act(() => save!.click());
    expect(useMetaStore.getState().settings).toMatchObject({
      density: 'compact', presentationSpeed: 'fast', spectatorAi: 'slow',
    });
    expect(status?.textContent).toBe('設定を保存しました。');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('保存');
  });

  it('resets only the draft and saves defaults without deleting unrelated settings', () => {
    useMetaStore.setState({
      settings: normalizeSettings({
        density: 'compact', presentationSpeed: 'fast', spectatorAi: 'slow',
        favorites: ['CT-D08-001'], cardBack: 'jade', bgmVolume: 25, seEnabled: false,
        tutorialClearedStepIds: ['L0-1'],
      }),
    });
    act(() => root.render(<SettingsScreen onNav={() => undefined} />));

    const reset = container.querySelector<HTMLButtonElement>('.settings-reset');
    expect(reset).not.toBeNull();
    expect(container.querySelector('[aria-haspopup="dialog"]')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    act(() => reset!.click());

    expect(container.querySelector('[role="status"]')?.textContent).toBe('未保存の変更があります。');
    const segmented = container.querySelectorAll<HTMLElement>('.settings-segmented');
    expect(segmented[0].querySelectorAll('button')[1].getAttribute('aria-pressed')).toBe('true');
    expect(segmented[1].querySelectorAll('button')[1].getAttribute('aria-pressed')).toBe('true');
    expect(segmented[2].querySelectorAll('button')[1].getAttribute('aria-pressed')).toBe('true');
    expect(useMetaStore.getState().settings).toMatchObject({
      density: 'compact', presentationSpeed: 'fast', spectatorAi: 'slow',
      favorites: ['CT-D08-001'], cardBack: 'jade', bgmVolume: 25, seEnabled: false,
      tutorialClearedStepIds: ['L0-1'],
    });

    act(() => container.querySelector<HTMLButtonElement>('.settings-save')!.click());
    expect(useMetaStore.getState().settings).toMatchObject({
      density: 'comfortable', presentationSpeed: 'standard', spectatorAi: 'standard',
      favorites: ['CT-D08-001'], cardBack: 'jade', bgmVolume: 25, seEnabled: false,
      tutorialClearedStepIds: ['L0-1'],
    });
  });

  it('hides decorative settings telemetry from the accessibility tree', () => {
    act(() => root.render(
      <MetaShell route="settings">
        <SettingsScreen onNav={() => undefined} />
      </MetaShell>,
    ));

    const telemetry = Array.from(container.querySelectorAll('div'))
      .find((node) => node.textContent === 'SYS · 0x4E8F · OK');
    expect(telemetry).toBeDefined();
    expect(telemetry?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('Wave 2 reduced motion styles', () => {
  it('removes the route fade and Wave 2 animation, blur, and translate effects', () => {
    const css = readFileSync('meta-app/src/screens/Wave2Motion.css', 'utf8');

    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/\.meta-fade[\s\S]*animation:\s*none !important/);
    expect(css).toMatch(/\.meta-fade[\s\S]*(filter|backdrop-filter):\s*none !important/);
    expect(css).toMatch(/\.history-screen[\s\S]*\.settings-screen[\s\S]*\.result-screen[\s\S]*\.replay-screen/);
    expect(css).toMatch(/transform:\s*none !important/);
  });
});
