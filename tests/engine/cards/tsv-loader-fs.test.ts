// Node-only loadSet retention test with deterministic, non-private fixture data.

import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSet } from '@/engine/cards/tsv-loader-fs';

const fixture = {
  reads: [] as string[],
  files: {
    'partner.tsv': [
      'cardNum\tcardId\ttitle\tcolor\tlp\trarity\tfeatures\timagePath\teffect\tillustrator\tqAndA',
      'P00001\tp1\tPartner\t青\t1\tD\t探偵\tpartner.webp\t\t\t',
    ].join('\n'),
    'character.tsv': [
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA',
      'C00001\tc1\tCharacter\t青\t5\t5000\t1\tD\t探偵\tcharacter.webp\t\t\t\t\t\t\t',
    ].join('\n'),
    'event.tsv': [
      'cardNum\tcardId\ttitle\tcolor\tlevel\trarity\timagePath\teffect\tcutIn\thirameki\tillustrator\tflavor\tqAndA',
      'E00001\te1\tEvent\t青\t3\tD\tevent.webp\t\t\t\t\t\t',
    ].join('\n'),
    'case.tsv': [
      'cardNum\tcardId\ttitle\tcolor\trarity\timagePath\tdifficultyFirst\tdifficultySecond\teffect\tillustrator\tqAndA',
      'K00001\tk1\tCase\t青\tD\tcase.webp\t7\t6\t\t\t',
    ].join('\n'),
  } as Record<string, string>,
};

describe('loadSet — direct Node module', () => {
  it('reads and parses every card kind without private card data', () => {
    const defs = loadSet('CT-D08', file => {
      const name = basename(file);
      fixture.reads.push(name);
      const text = fixture.files[name];
      if (text === undefined) throw new Error(`Unexpected fixture path: ${file}`);
      return text;
    });

    expect(fixture.reads).toEqual(['partner.tsv', 'character.tsv', 'event.tsv', 'case.tsv']);
    expect(defs.map(def => def.kind)).toEqual(['partner', 'character', 'event', 'case']);
    expect(defs.map(def => def.id)).toEqual(['P00001', 'C00001', 'E00001', 'K00001']);
  });
});
