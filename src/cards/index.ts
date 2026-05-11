// cards/index — トップレベル barrel + registerAll()
// rules: 02-deck-construction.md
//
// 設計メモ:
//   - Option A (lazy/explicit) を採用 — テスト容易性のため
//   - import 時点では何も登録されず、`registerAll()` 呼び出しで登録
//   - 個別カードを直接 import すれば部分的な登録も可能

import { engine } from '@/engine';
import type { CardDef } from '@/engine/types';

import { D08001 } from './ct-d08/D08001.js';
import { D08002 } from './ct-d08/D08002.js';
import { D08003 } from './ct-d08/D08003.js';
import { D08004 } from './ct-d08/D08004.js';
import { D08005 } from './ct-d08/D08005.js';
import { D08006 } from './ct-d08/D08006.js';
import { D08007 } from './ct-d08/D08007.js';
import { D08008 } from './ct-d08/D08008.js';
import { D08009 } from './ct-d08/D08009.js';
import { D08010 } from './ct-d08/D08010.js';
import { D08011 } from './ct-d08/D08011.js';
import { D08012 } from './ct-d08/D08012.js';
import { D08013 } from './ct-d08/D08013.js';
import { D08014 } from './ct-d08/D08014.js';
import { D08015 } from './ct-d08/D08015.js';
import { D08016 } from './ct-d08/D08016.js';
import { D08017 } from './ct-d08/D08017.js';
import { D08018 } from './ct-d08/D08018.js';
import { D08019 } from './ct-d08/D08019.js';
import { D08020 } from './ct-d08/D08020.js';
import { D08021 } from './ct-d08/D08021.js';
import { D08022 } from './ct-d08/D08022.js';
import { D08023 } from './ct-d08/D08023.js';
import { D08024 } from './ct-d08/D08024.js';
import { D08025 } from './ct-d08/D08025.js';
import { D08026 } from './ct-d08/D08026.js';

import { D11001 } from './ct-d11/D11001.js';
import { D11002 } from './ct-d11/D11002.js';
import { D11003 } from './ct-d11/D11003.js';
import { D11004 } from './ct-d11/D11004.js';
import { D11005 } from './ct-d11/D11005.js';
import { D11006 } from './ct-d11/D11006.js';
import { D11007 } from './ct-d11/D11007.js';
import { D11008 } from './ct-d11/D11008.js';
import { D11009 } from './ct-d11/D11009.js';
import { D11010 } from './ct-d11/D11010.js';
import { D11011 } from './ct-d11/D11011.js';
import { D11012 } from './ct-d11/D11012.js';
import { D11013 } from './ct-d11/D11013.js';
import { D11014 } from './ct-d11/D11014.js';
import { D11015 } from './ct-d11/D11015.js';
import { D11016 } from './ct-d11/D11016.js';
import { D11017 } from './ct-d11/D11017.js';
import { D11018 } from './ct-d11/D11018.js';
import { D11019 } from './ct-d11/D11019.js';
import { D11020 } from './ct-d11/D11020.js';
import { D11021 } from './ct-d11/D11021.js';

export {
  D08001, D08002, D08003, D08004, D08005, D08006, D08007, D08008,
  D08009, D08010, D08011, D08012, D08013, D08014, D08015, D08016,
  D08017, D08018, D08019, D08020, D08021, D08022, D08023,
  D08024, D08025, D08026,
};
export {
  D11001, D11002, D11003, D11004, D11005, D11006, D11007, D11008,
  D11009, D11010, D11011, D11012, D11013, D11014,
  D11015, D11016, D11017, D11018,
  D11019, D11020, D11021,
};

/**
 * Phase 5 Group C + D で実装済みの全 CardDef 配列。
 * Group E で追加されたら拡張する。
 */
export const ALL_CARDS: CardDef[] = [
  D08001, D08002,
  D08003, D08004, D08005, D08006, D08007, D08008,
  D08009, D08010, D08011, D08012, D08013, D08014, D08015, D08016,
  D08017, D08018, D08019, D08020, D08021, D08022, D08023,
  D08024, D08025, D08026,
  D11001, D11002, D11003, D11004, D11005, D11006, D11007, D11008,
  D11009, D11010, D11011, D11012, D11013, D11014,
  D11015, D11016, D11017, D11018,
  D11019, D11020, D11021,
];

/**
 * engine.cards.register に全 CardDef を投入する。
 * 同一 id を再登録した場合は上書きされる (registry の挙動)。
 * テストでは beforeEach で engine.cards._resetRegistry() してから呼ぶこと。
 */
export function registerAll(): void {
  for (const def of ALL_CARDS) {
    engine.cards.register(def);
  }
}
