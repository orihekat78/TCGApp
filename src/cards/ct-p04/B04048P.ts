// cards/ct-p04/B04048P 羽田秀𠮷 (キャラ パラレル) — B04048 の絵柄違い (同 cardId 0440)
// TSV 全列同文 (rarity SRP / imageUrl のみ差分) — rules/02 同 ID。句マッピングは B04048.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { B04048 } from './B04048.js';

export const B04048P: CardDef = {
  ...B04048,
  id: 'B04048P',
  no: '0440/B04048P',
  imageUrl: '1735287781731734.jpg',
  rarity: 'SRP',
};
