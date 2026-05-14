// Phase 7 Task 7.15: カード画像実行時 fetch + 二段キャッシュ + フォールバック
//
// 法務要件 (CLAUDE.md):
//   - カード画像はリポジトリ非同梱
//   - 実行時都度フェッチ
//   - 完全ローカル限定運用
//
// 設計:
//   1. memory cache (Map): 当該セッション内の重複問い合わせを抑止
//   2. localStorage cache: セッション跨ぎで「ok / not-ok」を記憶し
//      不要な HEAD 要求を抑止 (TTL: 7 日)
//   3. fallback: 取得失敗時は data: URI の SVG プレースホルダ
//
// 注: URL 解決 (cardId → URL) は呼び出し側の責務。本サービスは
//     candidateUrl を受け取って到達性検証 + キャッシュのみを行う。

const STORAGE_KEY = 'conan-tcg:card-image-cache:v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 日

type CacheEntry = {
  url: string;
  ok: boolean;
  ts: number;
};

const memoryCache = new Map<string, CacheEntry>();

// data: URI SVG — モックの .silhouette 相当 (60×84px 想定)
const PLACEHOLDER_DATA_URI =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 84" preserveAspectRatio="xMidYMid slice">' +
      '<defs>' +
        '<radialGradient id="g" cx="50%" cy="30%" r="60%">' +
          '<stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>' +
          '<stop offset="100%" stop-color="rgba(0,0,0,0.6)"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<rect width="60" height="84" fill="#0a1320"/>' +
      '<ellipse cx="30" cy="44" rx="20" ry="22" fill="url(#g)"/>' +
    '</svg>',
  );

export function getCardImagePlaceholder(): string {
  return PLACEHOLDER_DATA_URI;
}

function safeStorageRead(): Record<string, CacheEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function safeStorageWrite(cache: Record<string, CacheEntry>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // QuotaExceededError 等は黙殺 (画像は再フェッチ可能)
  }
}

function isFresh(entry: CacheEntry, now: number): boolean {
  return now - entry.ts < TTL_MS;
}

export type FetchCardImageOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/**
 * candidateUrl の到達性を HEAD で確認し、結果をキャッシュ。
 * - 既に memory にあれば即返却
 * - localStorage にあり TTL 内ならそれを使い、memory にも昇格
 * - 上記でなければ HEAD 要求 → 成功なら URL、失敗ならプレースホルダ
 *
 * @returns 表示用 URL (実 URL or data: URI placeholder)
 */
export async function fetchCardImageUrl(
  cardId: string,
  candidateUrl: string,
  options: FetchCardImageOptions = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = (options.now ?? Date.now)();

  // L1: memory
  const mem = memoryCache.get(cardId);
  if (mem && isFresh(mem, now)) {
    return mem.ok ? mem.url : PLACEHOLDER_DATA_URI;
  }

  // L2: localStorage
  const stored = safeStorageRead();
  const persisted = stored[cardId];
  if (persisted && isFresh(persisted, now)) {
    memoryCache.set(cardId, persisted);
    return persisted.ok ? persisted.url : PLACEHOLDER_DATA_URI;
  }

  // L3: network
  let entry: CacheEntry;
  try {
    if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
    const res = await fetchImpl(candidateUrl, { method: 'HEAD' });
    entry = { url: candidateUrl, ok: res.ok, ts: now };
  } catch {
    entry = { url: candidateUrl, ok: false, ts: now };
  }

  memoryCache.set(cardId, entry);
  safeStorageWrite({ ...stored, [cardId]: entry });

  return entry.ok ? entry.url : PLACEHOLDER_DATA_URI;
}

export function clearCardImageCache(): void {
  memoryCache.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

// テスト用 (内部キャッシュを露出させたくないが、テストでは状態確認したい)
export const __internals = {
  memoryCache,
  PLACEHOLDER_DATA_URI,
  STORAGE_KEY,
  TTL_MS,
};
