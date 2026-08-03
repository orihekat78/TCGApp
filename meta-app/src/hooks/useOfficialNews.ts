import { useEffect, useState } from 'react';
import { loadOfficialNews, readOfficialNewsCache, type OfficialNewsResult } from '../services/officialNews';

const INITIAL: OfficialNewsResult = { items: [], source: 'loading' };

export function useOfficialNews(): OfficialNewsResult {
  const [result, setResult] = useState<OfficialNewsResult>(() => readOfficialNewsCache() ?? INITIAL);

  useEffect(() => {
    const controller = new AbortController();
    void loadOfficialNews({ signal: controller.signal }).then((next) => {
      if (!controller.signal.aborted) setResult(next);
    }).catch(() => {
      // Aborted requests are intentionally ignored during route changes.
    });
    return () => controller.abort();
  }, []);

  return result;
}
