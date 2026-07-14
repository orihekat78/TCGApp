import { describe, expect, it } from 'vitest';
import { B03039 } from '@/cards/ct-p03/B03039';
import { B05028 } from '@/cards/ct-p05/B05028';
import { B08034 } from '@/cards/ct-p08/B08034';

const removeSetStep = (card: { abilities: Array<{ effect?: { steps?: Array<{ verb?: string; args?: Record<string, unknown> }> } }> }) =>
  card.abilities
    .flatMap((ability) => ability.effect?.steps ?? [])
    .find((step) => step.verb === 'charRemoveSetCard')!;

describe('BUG-169: face-down set-card removal', () => {
  for (const [id, card] of [['B03039', B03039], ['B05028', B05028], ['B08034', B08034]] as const) {
    it(`${id} removes only a face-down set card`, () => {
      const args = removeSetStep(card).args!;
      expect(args.faceDownOnly).toBe(true);
      expect(args.filter).toMatchObject({ hasFaceDownSetCards: true });
    });
  }
});
