// Round 3c-A: TutorialHighlight tests
// border + glow pulse + arrow による盤面要素のハイライト機構

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { TutorialHighlight } from '@/ui/components/TutorialHighlight';

describe('TutorialHighlight', () => {
  let container: HTMLDivElement;
  let root: Root;
  let targetEl: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // target を別 div として body に挿入 (TutorialHighlight が querySelector で参照)
    targetEl = document.createElement('div');
    targetEl.className = 'test-target';
    Object.defineProperty(targetEl, 'getBoundingClientRect', {
      value: () => ({ top: 100, left: 200, width: 300, height: 80, right: 500, bottom: 180, x: 200, y: 100, toJSON() { return {}; } }),
    });
    document.body.appendChild(targetEl);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    targetEl.remove();
  });

  it('renders highlight + arrow when target selector matches an element', () => {
    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.test-target' }} />);
    });
    const highlight = document.body.querySelector('.tutorial-highlight') as HTMLDivElement | null;
    const arrow = document.body.querySelector('.tutorial-arrow') as HTMLDivElement | null;
    expect(highlight).not.toBeNull();
    expect(arrow).not.toBeNull();
  });

  it('returns null when target selector does NOT match any element', () => {
    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.does-not-exist' }} />);
    });
    expect(document.body.querySelector('.tutorial-highlight')).toBeNull();
    expect(document.body.querySelector('.tutorial-arrow')).toBeNull();
  });

  it('positions highlight at target rect (top/left/width/height)', () => {
    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.test-target' }} />);
    });
    const highlight = document.body.querySelector('.tutorial-highlight') as HTMLDivElement;
    // rect: top=100 left=200 width=300 height=80
    expect(highlight.style.top).toBe('100px');
    expect(highlight.style.left).toBe('200px');
    expect(highlight.style.width).toBe('300px');
    expect(highlight.style.height).toBe('80px');
  });

  it('applies tutorial-arrow--top class when placement="top" (default)', () => {
    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.test-target' }} />);
    });
    const arrow = document.body.querySelector('.tutorial-arrow') as HTMLDivElement;
    expect(arrow.className).toContain('tutorial-arrow--top');
  });

  it('applies tutorial-arrow--right class when placement="right"', () => {
    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.test-target', placement: 'right' }} />);
    });
    const arrow = document.body.querySelector('.tutorial-arrow') as HTMLDivElement;
    expect(arrow.className).toContain('tutorial-arrow--right');
  });

  it('applies tutorial-arrow--bottom / --left for other placements', () => {
    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.test-target', placement: 'bottom' }} />);
    });
    expect((document.body.querySelector('.tutorial-arrow') as HTMLDivElement).className).toContain('tutorial-arrow--bottom');

    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.test-target', placement: 'left' }} />);
    });
    expect((document.body.querySelector('.tutorial-arrow') as HTMLDivElement).className).toContain('tutorial-arrow--left');
  });

  it('marks highlight and arrow as aria-hidden="true" (decorative)', () => {
    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.test-target' }} />);
    });
    const highlight = document.body.querySelector('.tutorial-highlight') as HTMLDivElement;
    const arrow = document.body.querySelector('.tutorial-arrow') as HTMLDivElement;
    expect(highlight.getAttribute('aria-hidden')).toBe('true');
    expect(arrow.getAttribute('aria-hidden')).toBe('true');
  });

  it('returns null when target rect is zero-size (width=0 / height=0 fallback)', () => {
    const zeroTarget = document.createElement('div');
    zeroTarget.className = 'zero-target';
    Object.defineProperty(zeroTarget, 'getBoundingClientRect', {
      value: () => ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() { return {}; } }),
    });
    document.body.appendChild(zeroTarget);
    act(() => {
      root.render(<TutorialHighlight target={{ selector: '.zero-target' }} />);
    });
    expect(document.body.querySelector('.tutorial-highlight')).toBeNull();
    zeroTarget.remove();
  });
});
