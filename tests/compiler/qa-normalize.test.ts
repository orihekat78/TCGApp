import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDirs: string[] = [];

function tempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'conan-qa-normalize-'));
  tempDirs.push(root);
  return root;
}

function expectQaParseError(run: () => unknown, expected: Record<string, string>) {
  let error: unknown;
  try {
    run();
  } catch (caught) {
    error = caught;
  }
  expect(error).toMatchObject(expected);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('compiler/qa-normalize', () => {
  it('normalizes 462 legacy JSON cards into 944 stable Q&A items without retaining source text', () => {
    const { normalizeQaCards, sha256 } = require('../../scripts/cards/qa-normalize.cjs');
    const cards = Array.from({ length: 462 }, (_, index) => {
      const itemCount = index < 20 ? 3 : 2; // 20 * 3 + 442 * 2 = 944
      const answers = Object.fromEntries(Array.from({ length: itemCount }, (_, question) => [
        `【Section ${index % 3}】 Q${index}-${question}`,
        `A${index}-${question}`,
      ]));
      return { card_num: `S${String(index).padStart(5, '0')}`, card_id: `C${index}`, q_a: JSON.stringify(answers) };
    });

    const result = normalizeQaCards(cards);

    expect(result.items).toHaveLength(944);
    expect(result.conflicts).toEqual([]);
    expect(result.items[0]).toMatchObject({
      cardId: 'C0',
      cardNums: ['S00000'],
      section: 'Section 0',
      questionHash: sha256('Q0-0'),
      answerHash: sha256('A0-0'),
      qaId: `card:C0:${sha256('Section 0\0Q0-0')}`,
    });
    expect(Object.keys(result.items[0]).sort()).toEqual([
      'answerHash', 'cardId', 'cardNums', 'qaId', 'questionHash', 'section',
    ]);
  });

  it('coalesces card printings across legacy JSON and Q/A text normalization variants', () => {
    const { normalizeQaCards, sha256 } = require('../../scripts/cards/qa-normalize.cjs');
    const result = normalizeQaCards([
      {
        card_num: 'B02086',
        card_id: '0086',
        q_a: JSON.stringify({ '【Rule】 Ｗｈａｔ\r\n is this?': ' Answer\u3000one ' }),
      },
      {
        card_num: 'B02086P',
        card_id: '0086',
        q_a: '【Rule】\r\nQ: What is this?\r\nA: Answer one',
      },
    ]);

    expect(result.conflicts).toEqual([]);
    expect(result.items).toEqual([{
      qaId: `card:0086:${sha256('Rule\0What is this?')}`,
      cardId: '0086',
      cardNums: ['B02086', 'B02086P'],
      section: 'Rule',
      questionHash: sha256('What is this?'),
      answerHash: sha256('Answer one'),
    }]);
  });

  it('starts a new Q/A item when repeated section headers occur in Q/A text', () => {
    const { normalizeQaCards } = require('../../scripts/cards/qa-normalize.cjs');
    const result = normalizeQaCards([{
      card_num: 'B02086',
      card_id: '0086',
      q_a: '【First】\nQ: One\nA: First answer\n【Second】\nQ: Two\nA: Second answer',
    }]);

    expect(result.items.map((item: { section: string }) => item.section)).toEqual(['First', 'Second']);
    expect(result.items).toHaveLength(2);
  });

  it('collects multiline questions before the answer marker under a Japanese section', () => {
    const { normalizeQaCards, sha256 } = require('../../scripts/cards/qa-normalize.cjs');
    const result = normalizeQaCards([{
      card_num: 'B02086',
      card_id: '0086',
      q_a: '【規則】\r\nQ: What is\r\nthis question?\r\nA: Answer',
    }]);

    expect(result.items).toEqual([expect.objectContaining({
      section: '規則',
      questionHash: sha256('What is this question?'),
      answerHash: sha256('Answer'),
    })]);
  });

  it('parses current official Q&A with an ability preamble before full-width markers', () => {
    const { normalizeQaCards, sha256 } = require('../../scripts/cards/qa-normalize.cjs');
    const result = normalizeQaCards([{
      card_num: 'D08003',
      card_id: '0489',
      q_a: '●Ability preamble\r\n\r\nQ：Does this count?\r\nA：Yes.',
    }]);

    expect(result).toMatchObject({
      conflicts: [],
      items: [expect.objectContaining({
        cardNums: ['D08003'],
        section: '●Ability preamble',
        questionHash: sha256('Does this count?'),
        answerHash: sha256('Yes.'),
      })],
    });
  });

  it('parses current official Q&A using period markers', () => {
    const { normalizeQaCards, sha256 } = require('../../scripts/cards/qa-normalize.cjs');
    const result = normalizeQaCards([{
      card_num: 'B04075',
      card_id: '0256',
      q_a: 'Q. Which resolves first?\r\nA. The turn player.',
    }]);

    expect(result.items).toEqual([expect.objectContaining({
      cardNums: ['B04075'],
      questionHash: sha256('Which resolves first?'),
      answerHash: sha256('The turn player.'),
    })]);
  });

  it.each([
    ['invalid JSON', '{not json', 'unrecognized-text'],
    ['JSON array', '["not supported"]', 'unsupported-json-array'],
    ['unlabeled text', 'text without Q and A labels', 'unrecognized-text'],
    ['missing answer label', 'Q: Missing answer', 'malformed-qa-text'],
  ])('surfaces %s as a structured parse error instead of silently dropping it', (_label, q_a, reason) => {
    const { normalizeQaCards } = require('../../scripts/cards/qa-normalize.cjs');

    expectQaParseError(() => normalizeQaCards([{ card_num: 'B02086P', card_id: '0086', q_a }]), {
      name: 'QaParseError',
      code: 'QA_PARSE_ERROR',
      cardId: '0086',
      cardNum: 'B02086P',
      reason,
    });
  });

  it('uses ordinal sorting for stable output regardless of locale', () => {
    const { compareOrdinal, normalizeQaCards } = require('../../scripts/cards/qa-normalize.cjs');
    const result = normalizeQaCards([
      { card_num: 'B2', card_id: 'a', q_a: JSON.stringify({ Question: 'Answer' }) },
      { card_num: 'B1', card_id: 'A', q_a: JSON.stringify({ Question: 'Answer' }) },
    ]);

    expect(compareOrdinal('A', 'a')).toBeLessThan(0);
    expect(result.items.map((item: { cardId: string }) => item.cardId)).toEqual(['A', 'a']);
  });

  it('keeps duplicate questions in separate sections and reports answer conflicts deterministically', () => {
    const { normalizeQaCards, sha256 } = require('../../scripts/cards/qa-normalize.cjs');
    const result = normalizeQaCards([
      {
        card_num: 'B06098',
        card_id: '0098',
        q_a: JSON.stringify({
          '【First】 Same question': 'Same answer',
          '【Second】 Same question': 'Same answer',
        }),
      },
      {
        card_num: 'B06098P',
        card_id: '0098',
        q_a: JSON.stringify({ '【First】 Same question': 'Different answer' }),
      },
    ]);

    expect(result.items.map((item: { qaId: string }) => item.qaId)).toEqual([
      `card:0098:${sha256('First\0Same question')}`,
      `card:0098:${sha256('Second\0Same question')}`,
    ]);
    expect(result.conflicts).toEqual([{
      qaId: `card:0098:${sha256('First\0Same question')}`,
      cardId: '0098',
      cardNums: ['B06098', 'B06098P'],
      answerHashes: [sha256('Different answer'), sha256('Same answer')].sort(),
    }]);
  });

  it('integrates raw Q&A as a separate compiler artifact without changing TSV card entries', () => {
    const { loadCorpus, loadQaCorpus } = require('../../scripts/compiler/tsv-corpus.cjs');
    const root = tempRoot();
    const dataDir = path.join(root, '.claude', 'specs', 'cards-data', 'CT-P01');
    const rawDir = path.join(root, '.claude', 'specs', 'cards-data', '_raw');
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(path.join(dataDir, 'character.tsv'), [
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA',
      'B02086\t0086\tSynthetic\tblue\t1\t1000\t1\tC\t\t\t\t\t\t\t\t\tlegacy source stays untouched',
    ].join('\n'));
    writeFileSync(path.join(rawDir, 'ct-p01-api.json'), JSON.stringify({ data: [{
      card_num: 'B02086', card_id: '0086', q_a: JSON.stringify({ '【Rule】 Question': 'Answer' }),
    }] }));

    const corpus = loadCorpus(root);
    const qa = loadQaCorpus(root);

    expect(corpus).toHaveLength(1);
    expect(corpus[0].qa).toBe('legacy source stays untouched');
    expect(qa).toMatchObject({ items: [{ cardId: '0086', cardNums: ['B02086'] }], conflicts: [] });
  });

  it('surfaces raw Q&A parse errors through tsv-corpus with card context', () => {
    const { loadQaCorpus } = require('../../scripts/compiler/tsv-corpus.cjs');
    const root = tempRoot();
    const rawDir = path.join(root, '.claude', 'specs', 'cards-data', '_raw');
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(path.join(rawDir, 'ct-p01-api.json'), JSON.stringify({ data: [{
      card_num: 'B06098', card_id: '0098', q_a: 'not Q/A text',
    }] }));

    expectQaParseError(() => loadQaCorpus(root), {
      name: 'QaParseError',
      code: 'QA_PARSE_ERROR',
      cardId: '0098',
      cardNum: 'B06098',
      reason: 'unrecognized-text',
    });
  });
});
