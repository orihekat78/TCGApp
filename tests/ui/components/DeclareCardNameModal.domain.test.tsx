import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetRegistry, register } from '@/engine/read/def';
import type { CardDef } from '@/engine/types';
import { DeclareCardNameModal } from '@/ui/components/DeclareCardNameModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DeclareCardNameModal declared-name domain', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    _resetRegistry();
    ['毛利小五郎', '毛利蘭', 'Conan', 'Ran', 'Kogoro', 'Conan Edogawa', 'Ran Mouri']
      .forEach((name, index) => register({
        id: `MODAL_TEST_${index}`,
        no: `MODAL_TEST_${index}`,
        kind: 'character',
        names: [name],
        colors: ['blue'],
        traits: [],
        rarity: 'C',
        imageUrl: '',
        abilities: [],
        ruleRefs: [],
        level: 1,
        ap: 1000,
        lp: 1,
      } as CardDef));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    _resetRegistry();
  });

  function enter(value: string): void {
    const input = container.querySelector<HTMLInputElement>('[data-testid="declare-card-name-input"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function key(keyName: string): void {
    const input = container.querySelector<HTMLInputElement>('[data-testid="declare-card-name-input"]')!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }));
    });
  }

  it('disables arbitrary text and confirms only an exact registered character candidate', () => {
    const onConfirm = vi.fn();
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="キャラ名を指定"
        candidateNames={['毛利小五郎']}
        domain="registered-character-card-name"
        onConfirm={onConfirm}
      />,
    ));
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-confirm"]')!;
    enter('黒の組織の事件');
    expect(confirm.disabled).toBe(true);
    act(() => confirm.click());
    expect(onConfirm).not.toHaveBeenCalled();

    enter('毛利小五郎');
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledWith('毛利小五郎');
  });

  it('preserves unrestricted arbitrary-name entry for existing cards', () => {
    const onConfirm = vi.fn();
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="カード名を指定"
        candidateNames={[]}
        onConfirm={onConfirm}
      />,
    ));
    enter('任意のカード名');
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-confirm"]')!;
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledWith('任意のカード名');
  });
  it('exposes the constrained registered-name domain, linked prompt, and full browse list', () => {
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name for this effect."
        candidateNames={['Conan', 'Ran', 'Kogoro']}
        domain="registered-character-card-name"
        onConfirm={vi.fn()}
      />,
    ));

    const input = container.querySelector<HTMLInputElement>('[data-testid="declare-card-name-input"]')!;
    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    const prompt = container.querySelector<HTMLElement>('[data-testid="declare-card-name-prompt"]')!;
    const guidance = container.querySelector<HTMLElement>('[data-testid="declare-card-name-domain-guidance"]')!;

    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(input.getAttribute('aria-describedby')).toContain(prompt.id);
    expect(input.getAttribute('aria-describedby')).toContain(guidance.id);
    expect(guidance.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(container.querySelector('[data-testid="declare-card-name-count"]')?.textContent).toContain('3');
  });

  it('confirms the exact active registered name with ArrowDown then Enter', () => {
    const onConfirm = vi.fn();
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name."
        candidateNames={['Conan', 'Ran']}
        domain="registered-character-card-name"
        onConfirm={onConfirm}
      />,
    ));

    const input = container.querySelector<HTMLInputElement>('[data-testid="declare-card-name-input"]')!;
    input.focus();
    key('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('declare-card-name-option-0');
    key('Enter');
    expect(onConfirm).toHaveBeenCalledWith('Conan');
  });

  it('wraps ArrowUp to the last registered candidate', () => {
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name."
        candidateNames={['Conan', 'Ran']}
        domain="registered-character-card-name"
        onConfirm={vi.fn()}
      />,
    ));

    const input = container.querySelector<HTMLInputElement>('[data-testid="declare-card-name-input"]')!;
    input.focus();
    key('ArrowUp');
    expect(input.getAttribute('aria-activedescendant')).toBe('declare-card-name-option-1');
  });

  it('confirms the canonical exact name only for a unique constrained search', () => {
    const onConfirm = vi.fn();
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name."
        candidateNames={['Conan Edogawa', 'Ran Mouri']}
        domain="registered-character-card-name"
        onConfirm={onConfirm}
      />,
    ));

    enter('Edogawa');
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-confirm"]')!;
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledWith('Conan Edogawa');

    enter('a');
    expect(confirm.disabled).toBe(true);
  });

  it('rejects an ambiguous constrained abbreviation', () => {
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name."
        candidateNames={['毛利小五郎', '毛利蘭']}
        domain="registered-character-card-name"
        onConfirm={vi.fn()}
      />,
    ));

    enter('毛利');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-confirm"]')?.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeInstanceOf(HTMLElement);
  });

  it('confirms the canonical exact name for a unique one-edit constrained search', () => {
    const onConfirm = vi.fn();
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name."
        candidateNames={['Conan']}
        domain="registered-character-card-name"
        onConfirm={onConfirm}
      />,
    ));

    enter('Conen');
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-confirm"]')!;
    expect(confirm.disabled).toBe(false);
    const resolution = container.querySelector<HTMLElement>('[data-testid="declare-card-name-resolution"]')!;
    expect(resolution.textContent).toContain('Conan');
    expect(container.querySelector('[role="option"]')?.textContent).toBe('Conan');
    expect(container.querySelector<HTMLInputElement>('[data-testid="declare-card-name-input"]')
      ?.getAttribute('aria-describedby')).toContain(resolution.id);
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledWith('Conan');
  });

  it('does not bypass shared-domain ambiguity with a locally unique candidate subset', () => {
    const onConfirm = vi.fn();
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name."
        candidateNames={['毛利小五郎']}
        domain="registered-character-card-name"
        onConfirm={onConfirm}
      />,
    ));

    enter('毛利');
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-confirm"]')!;
    expect(confirm.disabled).toBe(true);
    act(() => confirm.click());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeInstanceOf(HTMLElement);
  });

  it('routes Escape to the supplied cancel action', () => {
    const onCancel = vi.fn();
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name."
        candidateNames={['Conan']}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    ));

    key('Escape');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps optional skip and cancel reachable while explaining an invalid constrained name', () => {
    const onSkip = vi.fn();
    const onCancel = vi.fn();
    act(() => root.render(
      <DeclareCardNameModal
        open
        prompt="Choose a name."
        candidateNames={['Conan']}
        domain="registered-character-card-name"
        onConfirm={vi.fn()}
        onSkip={onSkip}
        onCancel={onCancel}
      />,
    ));

    enter('Unknown');
    expect(container.querySelector('[role="alert"]')).toBeInstanceOf(HTMLElement);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-confirm"]')?.disabled).toBe(true);
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-skip"]')!.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="declare-card-name-cancel"]')!.click());
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
