import { describe, expect, it } from 'vitest';
import { B10041 } from '@/cards/ct-p10/B10041';
import { B10051 } from '@/cards/ct-p10/B10051';
import { B10055 } from '@/cards/ct-p10/B10055';
import { B10058 } from '@/cards/ct-p10/B10058';
import { B10076 } from '@/cards/ct-p10/B10076';
import { B10078 } from '@/cards/ct-p10/B10078';
import { B10092 } from '@/cards/ct-p10/B10092';

describe('CT-P10 keyword-only cluster', () => {
  it('keeps all published metadata and does not drop cut-in or Hirameki text merely because the effect column is empty', () => {
    expect(B10041).toMatchObject({ id: 'B10041', no: '1101/B10041', kind: 'character', names: ['工藤優作'], colors: ['白'], level: 2, ap: 1000, lp: 1, traits: ['小説家'], rarity: 'C' });
    expect(B10055).toMatchObject({ id: 'B10055', no: '1114/B10055', kind: 'character', names: ['アンドレ・キャメル'], colors: ['赤'], level: 6, ap: 7000, lp: 0, traits: ['FBI'], rarity: 'C' });
    expect(B10092).toMatchObject({ id: 'B10092', no: '1147/B10092', kind: 'character', names: ['キール'], colors: ['黒'], level: 2, ap: 1000, lp: 1, traits: ['黒ずくめの組織'], rarity: 'C' });

    for (const card of [B10041, B10055, B10092]) {
      expect(card.abilities).toHaveLength(1);
      expect(card.abilities[0]).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } } });
    }
  });

  it('models the Hirameki choice and the conditional cut-ins with their printed gates', () => {
    expect(B10051).toMatchObject({ id: 'B10051', names: ['沖矢昴'], colors: ['赤'], level: 7, ap: 8000, lp: 1, abilities: [{ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'choice', chooser: 'self' } }] });
    expect(B10051.abilities[0]!.effect).toMatchObject({ options: [
      { kind: 'atom', verb: 'sceneSetState', args: { state: 'sleep', target: { n: { min: 0, max: 1 } } } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ] });

    expect(B10058).toMatchObject({ id: 'B10058', names: ['世良真純'], traits: ['探偵', '高校生', '赤井家'], abilities: [{ condition: { kind: 'partnerColor', color: '赤' } }] });
    expect(B10058.abilities[0]!.effect).toMatchObject({ kind: 'conditional', then: { kind: 'atom', verb: 'charModifyAP', args: { delta: 3000, scope: 'contact' } }, else: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, scope: 'contact' } } });

    expect(B10076).toMatchObject({ id: 'B10076', names: ['ナタリー・来間'], colors: ['黄'], abilities: [{ scope: 'on-hand' }, { scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true } }] });
    expect(B10076.abilities[0]!.effect).toMatchObject({ kind: 'sequence', steps: [{ kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, scope: 'contact' } }, { kind: 'conditional', then: { kind: 'atom', verb: 'draw', args: { n: 1 } } }] });
    expect(B10076.abilities[1]!.effect).toMatchObject({ kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: ['伊達航', '高木渉'] } } });

    expect(B10078).toMatchObject({ id: 'B10078', names: ['松田陣平'], traits: ['警察', '警視庁'], abilities: [{ scope: 'on-hand', condition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'turn', player: 'self' }]) } }, { scope: 'on-evidence', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } }] });
  });
});
