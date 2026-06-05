// cards/pr-01/PR208 キール (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// PR202 の絵柄違い (同 cardId 0836)。base を spread で再利用。

import type { CardDef } from '@/engine/types';
import { PR202 } from './PR202.js';

export const PR208: CardDef = { ...PR202, id: 'PR208', no: '0836/PR208', imageUrl: '1764290716082462.jpg' };
