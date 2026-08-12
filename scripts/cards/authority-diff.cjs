const { compareOrdinal } = require('./qa-normalize.cjs');

function uniqueMap(items, keyName, label) {
  const result = new Map();
  for (const item of items ?? []) {
    const key = String(item?.[keyName] ?? '').trim();
    if (!key) throw new Error(`${label} is missing ${keyName}`);
    if (result.has(key)) throw new Error(`duplicate ${label}: ${key}`);
    result.set(key, item);
  }
  return result;
}

function sortedDifference(left, right) {
  return [...left.keys()].filter((key) => !right.has(key)).sort(compareOrdinal);
}

function changedFieldNames(prior, next) {
  const names = new Set([...Object.keys(prior ?? {}), ...Object.keys(next ?? {})]);
  return [...names]
    .filter((name) => prior?.[name] !== next?.[name])
    .sort(compareOrdinal);
}

function buildAuthorityDiff(prior, next) {
  const priorCards = uniqueMap(prior?.fieldIndex?.cards, 'cardNum', 'prior authority card');
  const nextCards = uniqueMap(next?.fieldIndex?.cards, 'cardNum', 'next authority card');
  const priorQa = uniqueMap(prior?.qaSnapshot?.items, 'qaId', 'prior authority Q&A');
  const nextQa = uniqueMap(next?.qaSnapshot?.items, 'qaId', 'next authority Q&A');

  const changedFields = [...nextCards.keys()]
    .filter((cardNum) => priorCards.has(cardNum))
    .map((cardNum) => ({
      cardNum,
      fields: changedFieldNames(priorCards.get(cardNum)?.fields, nextCards.get(cardNum)?.fields),
    }))
    .filter((entry) => entry.fields.length > 0)
    .sort((left, right) => compareOrdinal(left.cardNum, right.cardNum));

  const qaAnswerChanged = [...nextQa.keys()]
    .filter((qaId) => priorQa.has(qaId) && priorQa.get(qaId).answerHash !== nextQa.get(qaId).answerHash)
    .sort(compareOrdinal);

  return {
    schemaVersion: 1,
    added: sortedDifference(nextCards, priorCards),
    removed: sortedDifference(priorCards, nextCards),
    changedFields,
    qaAdded: sortedDifference(nextQa, priorQa),
    qaRemoved: sortedDifference(priorQa, nextQa),
    qaAnswerChanged,
  };
}

module.exports = { buildAuthorityDiff };
