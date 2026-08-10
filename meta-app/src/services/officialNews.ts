export const OFFICIAL_NEWS_URL = 'https://www.takaratomy.co.jp/products/conan-cardgame/';

export const OFFICIAL_NEWS_CACHE_KEY = 'conan.meta.v1.official-news';
const CACHE_VERSION = 2;
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ITEMS = 12;

export interface OfficialNewsItem {
  id: string;
  category: string;
  title: string;
  date: string;
  url: string;
}

interface NewsCache {
  version: 2;
  fetchedAt: number;
  items: OfficialNewsItem[];
}

export interface OfficialNewsResult {
  items: OfficialNewsItem[];
  fetchedAt?: number;
  source: 'loading' | 'network' | 'cache' | 'stale' | 'empty';
}

interface LoadOptions {
  fetcher?: typeof fetch;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  now?: number;
  signal?: AbortSignal;
}

function boundedText(value: string | null | undefined, max: number): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeDate(value: string): string {
  const match = value.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1) return '';
  const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
  if (dayNumber > daysInMonth) return '';
  return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
}

function officialUrl(value: string): string | null {
  try {
    const url = new URL(value, OFFICIAL_NEWS_URL);
    if (url.protocol !== 'https:' || url.hostname !== 'www.takaratomy.co.jp') return null;
    if (url.port || url.username || url.password) return null;
    if (!url.pathname.startsWith('/products/conan-cardgame/')) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function validatedCacheItem(value: unknown): OfficialNewsItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<OfficialNewsItem>;
  if (typeof item.id !== 'string' || typeof item.url !== 'string' || item.id !== item.url) return null;
  const url = officialUrl(item.url);
  if (!url || url !== item.url) return null;
  if (typeof item.title !== 'string' || typeof item.category !== 'string' || typeof item.date !== 'string') return null;
  const title = boundedText(item.title, 120);
  const category = boundedText(item.category, 30);
  const date = normalizeDate(item.date);
  if (!title || title !== item.title || !category || category !== item.category || !date || date !== item.date) return null;
  return { id: url, category, title, date, url };
}

export function parseOfficialNews(html: string): OfficialNewsItem[] {
  if (typeof DOMParser === 'undefined') return [];
  const document = new DOMParser().parseFromString(html, 'text/html');
  const items: OfficialNewsItem[] = [];
  const seen = new Set<string>();

  for (const row of document.querySelectorAll('#news .newsList.all > li')) {
    const anchor = row.querySelector<HTMLAnchorElement>('a[href]');
    const url = anchor ? officialUrl(anchor.getAttribute('href') ?? '') : null;
    const title = boundedText(row.querySelector('.title')?.textContent, 120);
    const category = boundedText(row.querySelector('.category')?.textContent, 30);
    const time = row.querySelector('time');
    const date = normalizeDate(time?.getAttribute('datetime') ?? time?.textContent ?? '');
    if (!url || !title || !category || !date || seen.has(url)) continue;

    seen.add(url);
    items.push({ id: url, category, title, date, url });
    if (items.length === MAX_ITEMS) break;
  }
  return items;
}

function readCache(storage: LoadOptions['storage']): NewsCache | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(OFFICIAL_NEWS_CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<NewsCache>;
    if (value.version !== CACHE_VERSION || !Number.isFinite(value.fetchedAt) || !Array.isArray(value.items)) return null;
    const seen = new Set<string>();
    const items: OfficialNewsItem[] = [];
    for (const valueItem of value.items) {
      const item = validatedCacheItem(valueItem);
      if (!item || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
      if (items.length === MAX_ITEMS) break;
    }
    return items.length ? { version: CACHE_VERSION, fetchedAt: value.fetchedAt!, items } : null;
  } catch {
    return null;
  }
}

function writeCache(storage: LoadOptions['storage'], cache: NewsCache): void {
  if (!storage) return;
  try {
    storage.setItem(OFFICIAL_NEWS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage can be unavailable in private browsing; network data still renders.
  }
}

export function readOfficialNewsCache({
  storage = typeof localStorage === 'undefined' ? undefined : localStorage,
  now = Date.now(),
}: Pick<LoadOptions, 'storage' | 'now'> = {}): OfficialNewsResult | null {
  const cached = readCache(storage);
  if (!cached) return null;
  const age = now - cached.fetchedAt;
  return {
    items: cached.items,
    fetchedAt: cached.fetchedAt,
    source: age >= 0 && age < FRESH_FOR_MS ? 'cache' : 'stale',
  };
}

export async function loadOfficialNews({
  fetcher = fetch,
  storage = typeof localStorage === 'undefined' ? undefined : localStorage,
  now = Date.now(),
  signal,
}: LoadOptions = {}): Promise<OfficialNewsResult> {
  const cached = readOfficialNewsCache({ storage, now });
  if (cached?.source === 'cache') return cached;

  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetcher(OFFICIAL_NEWS_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`Official NEWS request failed: ${response.status}`);
    const items = parseOfficialNews(await response.text());
    if (!items.length) throw new Error('Official NEWS markup did not contain valid entries');
    const next = { version: CACHE_VERSION, fetchedAt: now, items } satisfies NewsCache;
    writeCache(storage, next);
    return { items, fetchedAt: now, source: 'network' };
  } catch (error) {
    if (signal?.aborted) throw error;
    return cached
      ? { ...cached, source: 'stale' }
      : { items: [], source: 'empty' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
