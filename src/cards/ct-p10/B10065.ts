// CT-P10 B10065 松田陣平＆萩原研二
import type { AbilityDef, CardDef } from '@/engine/types';
const names = ['降谷零', '諸伏景光', '伊達航', '萩原研二', '松田陣平'];
const a1: AbilityDef = { id: 'a1', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'turn', player: 'self' }] },
  trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', excludeSource: true, payloadKey: 'uid', filter: { cardName: names } } },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', levelMax: 9 } } },
  description: '【パートナー黄】【自分ターン中】【ターン1】自分の現場にこのキャラ以外の指定キャラが登場したとき、レベル9以下のキャラを1枚まで選び、リムーブする。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'] };
const a2: AbilityDef = { id: 'a2', type: 'triggered', scope: 'on-scene', condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '降谷零' }, { kind: 'turn', player: 'self' }] }, trigger: { hook: 'phase:end:start' },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', viaEffect: true, max: 1, bind: '$entered', filter: { kind: 'character', trait: '警察', levelMax: 3 } } },
    { kind: 'atom', verb: 'sceneSetState', args: { uid: '$entered.uid', state: 'sleep' } },
  ] } }, description: '【絆降谷零】自分のターン終了時、手札を1枚リムーブしてもよい。そうした場合、リムーブからレベル3以下の特徴［警察］をスリープ状態で登場。', ruleRefs: ['rules/15-abilities-effects.md'] };
const a3: AbilityDef = { id: 'a3', type: 'declared', scope: 'on-partner-area', limit: { kind: 'turn', n: 1 }, cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', side: 'self', max: 1, filter: { kind: 'character', cardName: ['降谷零', '諸伏景光', '伊達航'] }, delta: 2000, scope: 'turn' } },
  description: '【宣言】【ターン1】自分の現場の指定キャラを1枚までターン終了時までAP＋2000。この能力はパートナーエリアでも宣言できる。', ruleRefs: ['rules/15-abilities-effects.md'] };
const a4: AbilityDef = { id: 'a4', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000', ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'] };
export const B10065: CardDef = { id: 'B10065', no: '1121/B10065', kind: 'character', names: ['松田陣平＆萩原研二', '松田陣平', '萩原研二'], colors: ['黄'], level: 9, ap: 8000, lp: 2, traits: ['警察', '警視庁'], keywords: [], rarity: 'MR', imageUrl: '1783904183356249.jpg', abilities: [a1, a2, a3, a4], ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/21-declared-ability-cost.md', 'rules/22-qa-action-contact.md'] };
export const B10065P: CardDef = { ...B10065, id: 'B10065P', no: '1121/B10065P', rarity: 'MRP', imageUrl: '1783904183364547.jpg' };
export const B10065P2: CardDef = { ...B10065, id: 'B10065P2', no: '1121/B10065P2', rarity: 'MRP', imageUrl: '1783904183371978.jpg' };
