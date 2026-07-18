// Official Q&A is source material. This module emits only normalized metadata
// and hashes; callers must never write questions or answers into tracked output.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

class QaParseError extends Error {
  constructor(reason, { cardId = '', cardNum = '' } = {}) {
    super(`Q&A parse error: ${reason} (${cardNum}/${cardId})`);
    this.name = 'QaParseError';
    this.code = 'QA_PARSE_ERROR';
    this.reason = reason;
    this.cardId = cardId;
    this.cardNum = cardNum;
  }
}

function compareOrdinal(left, right) {
  const a = Array.from(String(left));
  const b = Array.from(String(right));
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = a[index].codePointAt(0) - b[index].codePointAt(0);
    if (difference) return difference;
  }
  return a.length - b.length;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t \n]+/g, ' ')
    // Official Japanese Q&A has incidental spaces inside a sentence on some
    // alternate printings. Keep word separation for Latin text, but make
    // CJK sentence spacing stable across printings.
    .replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}。、】【】]) ([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}【])/gu, '$1$2')
    .trim();
}

function isQaShaped(value) {
  if (value && typeof value === 'object') return !Array.isArray(value);
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text) return false;
  if (text.startsWith('{')) return true;
  const normalized = text.normalize('NFKC').replace(/\r\n?/g, '\n');
  return /(?:^|\n)\s*[QA](?:uestion|nswer)?\s*[.:]/im.test(normalized);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function splitSectionQuestion(value, fallbackSection = '') {
  const text = normalizeText(value);
  const match = text.match(/^【([^】]+)】\s*(.*)$/);
  return {
    section: normalizeText(match ? match[1] : fallbackSection),
    question: normalizeText(match ? match[2] : text),
  };
}

function parseQaText(value) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  const pairs = [];
  let section = '';
  const preamble = [];
  let question = null;
  let answerLines = null;

  const flush = () => {
    if (question === null) return;
    if (answerLines === null) throw new QaParseError('malformed-qa-text');
    const parsed = splitSectionQuestion(question, section);
    const answer = normalizeText(answerLines.join('\n'));
    if (!parsed.question || !answer) throw new QaParseError('malformed-qa-text');
    pairs.push({ ...parsed, answer });
    question = null;
    answerLines = null;
  };

  for (const line of text.split('\n')) {
    const sectionMatch = line.match(/^\s*【([^】]+)】\s*$/);
    if (sectionMatch) {
      flush();
      section = sectionMatch[1];
      continue;
    }
    const questionMatch = line.match(/^\s*Q(?:uestion)?\s*[.:：]\s*(.*)$/i);
    if (questionMatch) {
      flush();
      if (!section && preamble.length) section = normalizeText(preamble.join('\n'));
      question = questionMatch[1];
      continue;
    }
    const answerMatch = line.match(/^\s*A(?:nswer)?\s*[.:：]\s*(.*)$/i);
    if (answerMatch) {
      if (question === null || answerLines !== null) throw new QaParseError('malformed-qa-text');
      answerLines = [answerMatch[1]];
      continue;
    }
    if (answerLines !== null) {
      answerLines.push(line);
      continue;
    }
    if (question !== null) {
      question += `\n${line}`;
      continue;
    }
    if (line.trim()) {
      preamble.push(line);
      continue;
    }
  }
  flush();
  if (!pairs.length) throw new QaParseError('unrecognized-text');
  return pairs;
}

function parseQaObject(value, fallbackSection = '') {
  const pairs = [];
  for (const [key, answer] of Object.entries(value)) {
    if (Array.isArray(answer)) throw new QaParseError('unsupported-json-array');
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      pairs.push(...parseQaObject(answer, key));
      continue;
    }
    const parsed = splitSectionQuestion(key, fallbackSection);
    const normalizedAnswer = normalizeText(answer);
    if (parsed.question && normalizedAnswer) pairs.push({ ...parsed, answer: normalizedAnswer });
  }
  if (!pairs.length) throw new QaParseError('malformed-json-object');
  return pairs;
}

function parseQa(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) throw new QaParseError('unsupported-json-array');
  if (typeof value === 'object') return parseQaObject(value);
  if (typeof value !== 'string') throw new QaParseError('unsupported-value');
  const text = value.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) throw new QaParseError('unsupported-json-array');
    if (parsed && typeof parsed === 'object') return parseQaObject(parsed);
    throw new QaParseError('unsupported-json-value');
  } catch (error) {
    if (error instanceof QaParseError) throw error;
    // Plain Q/A text is a supported legacy shape.
  }
  return parseQaText(text);
}

function printableCardFamily(cardNum) {
  // P/P2 identifies an alternate printing of the immediately preceding card
  // number. `card_id` is not globally unique across released printings.
  return cardNum.replace(/^(.*\d)(?:P\d*|Sec\d+)$/, '$1');
}

function normalizeQaCards(cards) {
  const groups = new Map();
  for (const card of cards ?? []) {
    const internalCardId = normalizeText(card.card_id ?? card.cardId);
    const cardNum = normalizeText(card.card_num ?? card.cardNum);
    const qaValue = card.q_a ?? card.qAndA;
    if (qaValue == null || qaValue === '') continue;
    if (!internalCardId || !cardNum) throw new QaParseError('missing-card-identity', { cardId: internalCardId, cardNum });
    let pairs;
    try {
      pairs = parseQa(qaValue);
    } catch (error) {
      if (error instanceof QaParseError) throw new QaParseError(error.reason, { cardId: internalCardId, cardNum });
      throw error;
    }
    const cardId = printableCardFamily(cardNum);
    const occurrences = new Map();
    for (const pair of pairs) {
      const keyMaterial = `${pair.section}\0${pair.question}`;
      const occurrence = (occurrences.get(keyMaterial) ?? 0) + 1;
      occurrences.set(keyMaterial, occurrence);
      const qaId = `card:${cardId}:${sha256(occurrence === 1 ? keyMaterial : `${keyMaterial}\0${occurrence}`)}`;
      let group = groups.get(qaId);
      if (!group) {
        group = { qaId, cardId, section: pair.section, question: pair.question, answers: new Map(), cardNums: new Set() };
        groups.set(qaId, group);
      }
      group.cardNums.add(cardNum);
      const answerHash = sha256(pair.answer);
      if (!group.answers.has(answerHash)) group.answers.set(answerHash, pair.answer);
    }
  }

  const ordered = [...groups.values()].sort((a, b) =>
    compareOrdinal(a.cardId, b.cardId) || compareOrdinal(a.section, b.section) || compareOrdinal(a.question, b.question) || compareOrdinal(a.qaId, b.qaId),
  );
  const items = ordered.map((group) => {
    const answerHash = [...group.answers.keys()].sort(compareOrdinal)[0];
    return {
      qaId: group.qaId,
      cardId: group.cardId,
      cardNums: [...group.cardNums].sort(compareOrdinal),
      section: group.section,
      questionHash: sha256(group.question),
      answerHash,
    };
  });
  const conflicts = ordered
    .filter((group) => group.answers.size > 1)
    .map((group) => ({
      qaId: group.qaId,
      cardId: group.cardId,
      cardNums: [...group.cardNums].sort(compareOrdinal),
      answerHashes: [...group.answers.keys()].sort(compareOrdinal),
    }))
    .sort((a, b) => compareOrdinal(a.qaId, b.qaId));
  return { items, conflicts };
}

function loadRawQaCards(root) {
  const rawDir = path.join(root, '.claude', 'specs', 'cards-data', '_raw');
  if (!fs.existsSync(rawDir)) return [];
  const cards = [];
  for (const file of fs.readdirSync(rawDir).sort(compareOrdinal)) {
    if (!file.endsWith('-api.json')) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
    if (Array.isArray(raw.data)) cards.push(...raw.data);
  }
  return cards;
}

function loadQaCorpus(root) {
  return normalizeQaCards(loadRawQaCards(root).filter((card) => isQaShaped(card.q_a ?? card.qAndA)));
}

module.exports = { QaParseError, compareOrdinal, isQaShaped, loadQaCorpus, loadRawQaCards, normalizeQaCards, normalizeText, parseQa, sha256 };
