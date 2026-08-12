// engine.cards.tsv-loader-fs — Node 専用 TSV ファイル読込
// rules: 02-deck-construction.md, 06-card-types.md, 19-special-rules.md, 20-color-and-switch.md
// spec: .claude/specs/cards-data/INDEX.md
//
// 設計メモ:
//   - tsv-loader.ts (pure parseTsv) から node:fs 依存を分離した Node 経路 API。
//   - cards/index.ts / engine/index.ts からは **意図的に re-export しない**。
//     ブラウザバンドルに node:fs externalized proxy が混入するのを避ける。
//   - Node専用のtests / scriptsだけがこのモジュールを直接importする。

import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type { CardDef } from '../types/index.js';
import { parseTsv } from './tsv-loader.js';

// ---------- パス解決 ----------
// このファイル: src/engine/cards/tsv-loader-fs.ts
// プロジェクトルート: ../../..

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolvePath(__dirname, '..', '..', '..');
const CARDS_DATA_DIR = resolvePath(PROJECT_ROOT, '.claude', 'specs', 'cards-data');
const require = createRequire(import.meta.url);
const { withCardsDataSnapshot } = require('../../../scripts/cards/official-api.cjs') as {
  withCardsDataSnapshot<T>(options: {
    baseDir: string;
    read: () => T;
  }): T;
};

/**
 * セット内の全 TSV (partner/character/event/case) を読みこみ CardDef[] にする。
 * abilities は空配列 (Phase 5 Group B-E で共通クラス側から merge する)。
 */
export function loadSet(
  setCode: 'CT-D08' | 'CT-D11',
  readText: (file: string) => string = file => readFileSync(file, 'utf8'),
): CardDef[] {
  return withCardsDataSnapshot({
    baseDir: CARDS_DATA_DIR,
    read: () => {
      const setDir = setCode.toLowerCase();
      const dir = resolvePath(CARDS_DATA_DIR, setDir);
      const out: CardDef[] = [];
      const kinds: CardDef['kind'][] = ['partner', 'character', 'event', 'case'];
      for (const k of kinds) {
        const file = resolvePath(dir, `${k}.tsv`);
        const text = readText(file);
        out.push(...parseTsv(text, k));
      }
      return out;
    },
  });
}
