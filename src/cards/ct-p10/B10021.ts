// CT-P10 B10021 服部平蔵＆遠山銀司郎 — rules: 14-refresh.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'and', cs: [
    { kind: 'partnerColor', color: '緑' },
    { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 2 },
  ] },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMax: 9 }, cause: 'effect' } },
    { kind: 'atom', verb: 'charSetCard', args: { player: 'self', side: 'self', max: 1, filter: { kind: 'character', trait: '警察' }, fromDeckTop: true, faceUp: false } },
  ] },
  description: '【パートナー緑】【宣言】【ターン1】レベル9以下のキャラを1枚まで選び、リムーブする。自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。この能力は自分の現場に〚特徴［警察］〛のキャラが2枚以上いる場合に宣言できる。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-partner-area', limit: { kind: 'turn', n: 2 },
  cost: { kind: 'removeSetCard', n: 1 },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  ] },
  description: '【宣言】【ターン2】〚現場にいるキャラに裏向きでセットされているカードを1枚リムーブする〛：カードを1枚引き、手札を1枚リムーブする。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B10021: CardDef = {
  id: 'B10021', no: '1082/B10021', kind: 'character', names: ['服部平蔵＆遠山銀司郎', '服部平蔵', '遠山銀司郎'], colors: ['緑'], level: 9, ap: 8000, lp: 2,
  traits: ['警察', '大阪府警'], keywords: ['カットイン'], rarity: 'MR', imageUrl: '1783904095055458.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10021P: CardDef = { ...B10021, id: 'B10021P', no: '1082/B10021P', rarity: 'MRP', imageUrl: '1783904095062857.jpg' };
