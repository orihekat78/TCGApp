// engine/cards barrel export

export { cards } from './registry.js';
export { parseTsv } from './tsv-loader.js';
// `loadSet` は node:fs 依存のため `./tsv-loader-fs.js` に分離。
// ブラウザバンドルに巻き込まないようここでは re-export しない。
// Node 経路 (tests / scripts) は `@/engine/cards/tsv-loader-fs` から直接 import する。
