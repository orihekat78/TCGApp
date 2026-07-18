// Official Q&A is source material. This module emits only normalized metadata
// and hashes; callers must never write questions or answers into tracked output.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t \n]+/g, ' ')
    .trim();
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
  const sectionMatch = text.match(/^\s*【([^】]+)】\s*(?:\n|$)/);
  const section = sectionMatch ? sectionMatch[1] : '';
  const body = sectionMatch ? text.slice(sectionMatch[0].length) : text;
  const pairs = [];
  const re = /(?:^|\n)\s*Q(?:uestion)?\s*[:：]\s*([\s\S]*?)\n\s*A(?:nswer)?\s*[:：]\s*([\s\S]*?)(?=\n\s*Q(?:uestion)?\s*[:：]|$)/gi;
  let match;
  while ((match = re.exec(body))) {
    const parsed = splitSectionQuestion(match[1], section);
    if (parsed.question && normalizeText(match[2])) {
      pairs.push({ ...parsed, answer: normalizeText(match[2]) });
    }
  }
  return pairs;
}

function parseQaObject(value, fallbackSection = '') {
  const pairs = [];
  for (const [key, answer] of Object.entries(value)) {
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      pairs.push(...parseQaObject(answer, key));
      continue;
    }
    const parsed = splitSectionQuestion(key, fallbackSection);
    const normalizedAnswer = normalizeText(answer);
    if (parsed.question && normalizedAnswer) pairs.push({ ...parsed, answer: normalizedAnswer });
  }
  return pairs;
}

function parseQa(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return parseQaObject(value);
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parseQaObject(parsed);
  } catch {
    // Plain Q/A text is a supported legacy shape.
  }
  return parseQaText(text);
}

function normalizeQaCards(cards) {
  const groups = new Map();
  for (const card of cards ?? []) {
    const cardId = normalizeText(card.card_id ?? card.cardId);
    const cardNum = normalizeText(card.card_num ?? card.cardNum);
    if (!cardId || !cardNum) continue;
    for (const pair of parseQa(card.q_a ?? card.qAndA)) {
      const keyMaterial = `${pair.section}\0${pair.question}`;
      const qaId = `card:${cardId}:${sha256(keyMaterial)}`;
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
    a.cardId.localeCompare(b.cardId) || a.section.localeCompare(b.section) || a.question.localeCompare(b.question),
  );
  const items = ordered.map((group) => {
    const answerHash = [...group.answers.keys()].sort()[0];
    return {
      qaId: group.qaId,
      cardId: group.cardId,
      cardNums: [...group.cardNums].sort(),
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
      cardNums: [...group.cardNums].sort(),
      answerHashes: [...group.answers.keys()].sort(),
    }))
    .sort((a, b) => a.qaId.localeCompare(b.qaId));
  return { items, conflicts };
}

function loadRawQaCards(root) {
  const rawDir = path.join(root, '.claude', 'specs', 'cards-data', '_raw');
  if (!fs.existsSync(rawDir)) return [];
  const cards = [];
  for (const file of fs.readdirSync(rawDir).sort()) {
    if (!file.endsWith('-api.json')) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
    if (Array.isArray(raw.data)) cards.push(...raw.data);
  }
  return cards;
}

function loadQaCorpus(root) {
  return normalizeQaCards(loadRawQaCards(root));
}

module.exports = { loadQaCorpus, loadRawQaCards, normalizeQaCards, normalizeText, parseQa, sha256 };
