// CT-P10 B10042 工藤有希子
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'charSetCard', args: { player: 'self', side: 'self', max: 1, excludeSelf: true, filter: { kind: 'character', color: '白' }, fromDeckTop: true, faceUp: false, bind: '$target' } },
    { kind: 'atom', verb: 'charModifyAP', args: { uid: '$target.uid', delta: 1000, scope: 'turn' } },
  ] },
  description: '【登場時】自分の現場にいるこのキャラ以外の【白】のキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットし、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'disguise:into', selfOnly: true },
  condition: { kind: 'bond', cardName: '工藤優作' },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'turn' } },
  description: '【絆工藤優作】【変装時】ターン終了時までこのキャラをAP＋2000する。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'icon-disguise',
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '白' }, { kind: 'fileAtLeast', n: 5 }] },
  description: '【変装】【パートナー白】【FILE5】',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

export const B10042: CardDef = {
  id: 'B10042', no: '1102/B10042', kind: 'character', names: ['工藤有希子'], colors: ['白'], level: 4, ap: 3000, lp: 1,
  traits: ['女優'], keywords: [], rarity: 'C', imageUrl: '1783904138016048.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
