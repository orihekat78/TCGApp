// Phase 7 Task 7.15: cardImage service tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchCardImageUrl,
  getCardImagePlaceholder,
  clearCardImageCache,
  __internals,
} from '@/ui/services/cardImage';

function makeFetchMock(responses: Array<{ ok: boolean; status?: number } | Error>) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) {
      fn.mockRejectedValueOnce(r);
    } else {
      fn.mockResolvedValueOnce({ ok: r.ok, status: r.status ?? (r.ok ? 200 : 404) });
    }
  }
  return fn as unknown as typeof fetch;
}

describe('cardImage service', () => {
  beforeEach(() => {
    clearCardImageCache();
    // localStorage は jsdom 環境で利用可。テスト間隔離のため毎回クリア
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(__internals.STORAGE_KEY); } catch {}
    }
  });

  it('returns a data: URI placeholder', () => {
    const ph = getCardImagePlaceholder();
    expect(ph).toMatch(/^data:image\/svg\+xml/);
    expect(ph).toContain('encodeURIComponent' /* false positive guard */ === 'x' ? 'x' : 'svg');
  });

  it('returns the candidate URL when fetch succeeds (200)', async () => {
    const fetchImpl = makeFetchMock([{ ok: true }]);
    const url = await fetchCardImageUrl('C-001', 'https://example.com/a.jpg', { fetchImpl });
    expect(url).toBe('https://example.com/a.jpg');
    expect((fetchImpl as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('returns placeholder when fetch returns non-ok (404)', async () => {
    const fetchImpl = makeFetchMock([{ ok: false, status: 404 }]);
    const url = await fetchCardImageUrl('C-002', 'https://example.com/missing.jpg', { fetchImpl });
    expect(url).toBe(getCardImagePlaceholder());
  });

  it('returns placeholder when fetch throws (network error)', async () => {
    const fetchImpl = makeFetchMock([new Error('network down')]);
    const url = await fetchCardImageUrl('C-003', 'https://example.com/x.jpg', { fetchImpl });
    expect(url).toBe(getCardImagePlaceholder());
  });

  it('hits memory cache on 2nd call without network', async () => {
    const fetchImpl = makeFetchMock([{ ok: true }]);
    const url1 = await fetchCardImageUrl('C-004', 'https://example.com/a.jpg', { fetchImpl });
    const url2 = await fetchCardImageUrl('C-004', 'https://example.com/a.jpg', { fetchImpl });
    expect(url1).toBe(url2);
    expect((fetchImpl as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('persists to localStorage and uses it across sessions (memory cleared)', async () => {
    const fetchImpl = makeFetchMock([{ ok: true }]);
    await fetchCardImageUrl('C-005', 'https://example.com/p.jpg', { fetchImpl });

    // Simulate new session: clear memory cache only
    __internals.memoryCache.clear();

    const fetchImpl2 = makeFetchMock([]); // no calls allowed
    const url = await fetchCardImageUrl('C-005', 'https://example.com/p.jpg', { fetchImpl: fetchImpl2 });
    expect(url).toBe('https://example.com/p.jpg');
    expect((fetchImpl2 as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('refetches after TTL expires', async () => {
    const t0 = 1_000_000;
    const fetchImpl = makeFetchMock([{ ok: true }, { ok: true }]);
    await fetchCardImageUrl('C-006', 'https://example.com/q.jpg', {
      fetchImpl,
      now: () => t0,
    });

    __internals.memoryCache.clear();
    const tFuture = t0 + __internals.TTL_MS + 1;
    await fetchCardImageUrl('C-006', 'https://example.com/q.jpg', {
      fetchImpl,
      now: () => tFuture,
    });
    expect((fetchImpl as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });

  it('caches not-ok result and returns placeholder on subsequent calls without re-fetch', async () => {
    const fetchImpl = makeFetchMock([{ ok: false, status: 404 }]);
    const url1 = await fetchCardImageUrl('C-007', 'https://example.com/404.jpg', { fetchImpl });
    expect(url1).toBe(getCardImagePlaceholder());

    const fetchImpl2 = makeFetchMock([]); // no calls allowed
    const url2 = await fetchCardImageUrl('C-007', 'https://example.com/404.jpg', { fetchImpl: fetchImpl2 });
    expect(url2).toBe(getCardImagePlaceholder());
    expect((fetchImpl2 as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('clearCardImageCache empties both memory and localStorage', async () => {
    const fetchImpl = makeFetchMock([{ ok: true }]);
    await fetchCardImageUrl('C-008', 'https://example.com/r.jpg', { fetchImpl });
    expect(__internals.memoryCache.size).toBeGreaterThan(0);
    clearCardImageCache();
    expect(__internals.memoryCache.size).toBe(0);
    if (typeof localStorage !== 'undefined') {
      expect(localStorage.getItem(__internals.STORAGE_KEY)).toBeNull();
    }
  });

  it('survives malformed localStorage gracefully (re-fetches)', async () => {
    if (typeof localStorage === 'undefined') return; // jsdom 必須
    localStorage.setItem(__internals.STORAGE_KEY, '<<not-json>>');
    const fetchImpl = makeFetchMock([{ ok: true }]);
    const url = await fetchCardImageUrl('C-009', 'https://example.com/s.jpg', { fetchImpl });
    expect(url).toBe('https://example.com/s.jpg');
  });

  it('caches per cardId, not per URL', async () => {
    const fetchImpl = makeFetchMock([{ ok: true }, { ok: true }]);
    await fetchCardImageUrl('C-010', 'https://a.com/x.jpg', { fetchImpl });
    await fetchCardImageUrl('C-011', 'https://b.com/x.jpg', { fetchImpl });
    expect((fetchImpl as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
    expect(__internals.memoryCache.get('C-010')?.url).toBe('https://a.com/x.jpg');
    expect(__internals.memoryCache.get('C-011')?.url).toBe('https://b.com/x.jpg');
  });
});
