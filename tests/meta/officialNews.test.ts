import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OFFICIAL_NEWS_CACHE_KEY,
  OFFICIAL_NEWS_URL,
  loadOfficialNews,
  parseOfficialNews,
  readOfficialNewsCache,
} from "../../meta-app/src/services/officialNews";

const HTML = `
  <section id="news">
    <ul class="newsList all">
      <li><a href="/products/conan-cardgame/news/20260731.html">
        <span class="category">イベント</span>
        <span class="title">【7月31日更新】探偵サミット2026</span>
        <time datetime="2026-07-31">2026.7.31</time>
      </a></li>
      <li><a href="https://www.takaratomy.co.jp/products/conan-cardgame/news/20260727.html">
        <span class="category">商品情報</span>
        <span class="title">新商品のお知らせ</span>
        <time>2026.7.27</time>
      </a></li>
      <li><a href="https://evil.example/news">
        <span class="category">その他</span><span class="title">偽のお知らせ</span><time>2026.7.25</time>
      </a></li>
      <li><a href="https://www.takaratomy.co.jp:444/products/conan-cardgame/news/port.html">
        <span class="category">その他</span><span class="title">別ポート</span><time>2026.7.24</time>
      </a></li>
      <li><a href="https://user@www.takaratomy.co.jp/products/conan-cardgame/news/credentials.html">
        <span class="category">その他</span><span class="title">認証情報付き</span><time>2026.7.23</time>
      </a></li>
      <li><a href="/products/conan-cardgame/news/20260731.html">
        <span class="category">イベント</span><span class="title">重複</span><time>2026.7.31</time>
      </a></li>
    </ul>
  </section>`;

describe("official NEWS boundary", () => {
  beforeEach(() => localStorage.clear());

  it("extracts public metadata, normalizes dates, rejects foreign hosts, and deduplicates canonical URLs", () => {
    expect(parseOfficialNews(HTML)).toEqual([
      {
        id: "https://www.takaratomy.co.jp/products/conan-cardgame/news/20260731.html",
        category: "イベント",
        title: "【7月31日更新】探偵サミット2026",
        date: "2026-07-31",
        url: "https://www.takaratomy.co.jp/products/conan-cardgame/news/20260731.html",
      },
      {
        id: "https://www.takaratomy.co.jp/products/conan-cardgame/news/20260727.html",
        category: "商品情報",
        title: "新商品のお知らせ",
        date: "2026-07-27",
        url: "https://www.takaratomy.co.jp/products/conan-cardgame/news/20260727.html",
      },
    ]);
  });

  it("returns an empty list for missing or malformed listing markup", () => {
    expect(
      parseOfficialNews(
        '<main><a href="/products/conan-cardgame/news/x">no fields</a></main>',
      ),
    ).toEqual([]);
  });

  it("uses a fresh six-hour cache without issuing a second request", async () => {
    const now = Date.UTC(2026, 7, 2, 12);
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(HTML, { status: 200 }));
    const first = await loadOfficialNews({
      fetcher,
      storage: localStorage,
      now,
    });
    const second = await loadOfficialNews({
      fetcher,
      storage: localStorage,
      now: now + 6 * 60 * 60 * 1000 - 1,
    });

    expect(first.source).toBe("network");
    expect(second.source).toBe("cache");
    expect(second.items).toEqual(first.items);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      OFFICIAL_NEWS_URL,
      expect.objectContaining({
        referrerPolicy: "no-referrer",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("returns empty without contacting the official site when network access is disabled", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(HTML, { status: 200 }));
    const result = await loadOfficialNews({
      allowNetwork: false,
      fetcher,
      storage: localStorage,
      now: Date.UTC(2026, 7, 2, 12),
    });

    expect(result).toEqual({ items: [], source: "empty" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps stale cached metadata without refreshing when network access is disabled", async () => {
    const now = Date.UTC(2026, 7, 2, 12);
    const initial = await loadOfficialNews({
      fetcher: vi.fn().mockResolvedValue(new Response(HTML, { status: 200 })),
      storage: localStorage,
      now,
    });

    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(HTML, { status: 200 }));
    const result = await loadOfficialNews({
      allowNetwork: false,
      fetcher,
      storage: localStorage,
      now: now + 6 * 60 * 60 * 1000,
    });

    expect(result).toEqual({
      ...initial,
      source: "stale",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refreshes a fresh legacy cache created under the three-item limit", async () => {
    const now = Date.UTC(2026, 7, 3, 12);
    localStorage.setItem(
      OFFICIAL_NEWS_CACHE_KEY,
      JSON.stringify({
        version: 1,
        fetchedAt: now,
        items: parseOfficialNews(HTML).slice(0, 1),
      }),
    );
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(HTML, { status: 200 }));

    const result = await loadOfficialNews({
      fetcher,
      storage: localStorage,
      now,
    });

    expect(result.source).toBe("network");
    expect(result.items).toEqual(parseOfficialNews(HTML));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(localStorage.getItem(OFFICIAL_NEWS_CACHE_KEY)!),
    ).toMatchObject({ version: 2 });
  });

  it("keeps stale official metadata when refresh fails", async () => {
    const now = Date.UTC(2026, 7, 2, 12);
    await loadOfficialNews({
      fetcher: vi.fn().mockResolvedValue(new Response(HTML, { status: 200 })),
      storage: localStorage,
      now,
    });

    const result = await loadOfficialNews({
      fetcher: vi.fn().mockRejectedValue(new Error("offline")),
      storage: localStorage,
      now: now + 6 * 60 * 60 * 1000,
    });

    expect(result.source).toBe("stale");
    expect(result.items).toHaveLength(2);
  });

  it("treats a future cache timestamp as stale and refreshes it", async () => {
    const now = Date.UTC(2026, 7, 2, 12);
    await loadOfficialNews({
      fetcher: vi.fn().mockResolvedValue(new Response(HTML, { status: 200 })),
      storage: localStorage,
      now: now + 60_000,
    });
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(HTML, { status: 200 }));

    const result = await loadOfficialNews({
      fetcher,
      storage: localStorage,
      now,
    });

    expect(result.source).toBe("network");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed cached identities and overlong metadata", () => {
    localStorage.setItem(
      OFFICIAL_NEWS_CACHE_KEY,
      JSON.stringify({
        version: 1,
        fetchedAt: Date.UTC(2026, 7, 2, 12),
        items: [
          {
            id: "forged-id",
            category: "x".repeat(31),
            title: "y".repeat(121),
            date: "2026-99-99",
            url: "https://www.takaratomy.co.jp/products/conan-cardgame/news/forged.html",
          },
        ],
      }),
    );

    expect(
      readOfficialNewsCache({
        storage: localStorage,
        now: Date.UTC(2026, 7, 2, 12),
      }),
    ).toBeNull();
  });

  it("exposes stale cached metadata synchronously for stale-while-revalidate rendering", async () => {
    const now = Date.UTC(2026, 7, 2, 12);
    await loadOfficialNews({
      fetcher: vi.fn().mockResolvedValue(new Response(HTML, { status: 200 })),
      storage: localStorage,
      now,
    });

    const cached = readOfficialNewsCache({
      storage: localStorage,
      now: now + 6 * 60 * 60 * 1000,
    });

    expect(cached).toMatchObject({
      source: "stale",
      items: parseOfficialNews(HTML),
    });
  });

  it("returns a stable empty result when the network and cache are unavailable", async () => {
    const result = await loadOfficialNews({
      fetcher: vi.fn().mockRejectedValue(new Error("offline")),
      storage: localStorage,
      now: Date.UTC(2026, 7, 2, 12),
    });

    expect(result).toMatchObject({ items: [], source: "empty" });
  });

  it("does not start a request when cancellation already happened", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));
    const fetcher = vi.fn();

    await expect(
      loadOfficialNews({
        fetcher,
        storage: localStorage,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects impossible calendar dates from remote markup", () => {
    const html = HTML.replaceAll("2026-07-31", "2026-99-99").replaceAll(
      "2026.7.31",
      "2026.99.99",
    );
    expect(parseOfficialNews(html).map((item) => item.title)).not.toContain(
      "【7月31日更新】探偵サミット2026",
    );
  });
});
