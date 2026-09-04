const fs = require('node:fs');
const path = require('node:path');

const QA_ID = /^card:[A-Z]\d{5}:[a-f0-9]{64}$/;
const FILE = 'qa-source-corrections.json';

function readQaSourceCorrections(baseDir) {
  const file = path.join(baseDir, FILE);
  if (!fs.existsSync(file)) return new Set();
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.excludedQaIds)
    || Object.keys(value).some((key) => !['schemaVersion', 'excludedQaIds'].includes(key))
    || value.excludedQaIds.some((qaId) => typeof qaId !== 'string' || !QA_ID.test(qaId))) {
    throw new Error('invalid Q&A source corrections');
  }
  const ids = [...value.excludedQaIds].sort();
  if (new Set(ids).size !== ids.length || ids.some((qaId, index) => qaId !== value.excludedQaIds[index])) {
    throw new Error('Q&A source corrections must be unique and sorted');
  }
  return new Set(ids);
}

function applyQaSourceCorrections(corpus, excludedQaIds) {
  if (!excludedQaIds.size) return corpus;
  return {
    items: corpus.items.filter((item) => !excludedQaIds.has(item.qaId)),
    conflicts: corpus.conflicts.filter((item) => !excludedQaIds.has(item.qaId)),
  };
}

module.exports = { applyQaSourceCorrections, readQaSourceCorrections };
