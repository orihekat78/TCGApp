export type MatchSessionToken = number;

function fallbackMatchSessionNamespace(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (part) => {
    const random = Math.floor(Math.random() * 16);
    return (part === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

const matchSessionNamespace = globalThis.crypto?.randomUUID?.() ?? fallbackMatchSessionNamespace();

/** Stable for one runtime session and namespaced across reloads. */
export function matchSessionId(token: MatchSessionToken): string {
  if (!Number.isSafeInteger(token) || token < 1) throw new Error('Invalid match session token');
  return `match-${matchSessionNamespace}-${token}`;
}
