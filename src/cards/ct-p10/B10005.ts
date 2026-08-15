// CT-P10 B10005 灰原哀
// rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'and', cs: [
    { kind: 'turn', player: 'self' },
    { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'サッカー選手' } }, nMin: 3 },
  ] },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '自分のターン終了時、自分の現場に〚特徴［サッカー選手］〛のキャラが3枚以上いる場合、カードを1枚引く。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: { kind: 'optional', effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
      { kind: 'atom', verb: 'sceneEnter', args: {
        player: 'self', cardId: '$pick.cardId', from: 'hand', viaEffect: true, bind: '$entered',
        target: { kind: 'pick', chooser: 'self', n: { min: 0, max: 1 }, query: { area: 'hand', side: 'self', filter: { kind: 'character', trait: 'サッカー選手', levelMax: 6 } } },
      } },
      { kind: 'conditional', if: { kind: 'boundAnyMatchesFilter', bindKey: '$entered', filter: { cardName: '比護隆佑' } }, then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
    ] } },
  },
  description: '【登場時】このキャラをスリープさせてもよい。そうした場合、手札からレベル6以下の〚特徴［サッカー選手］〛のキャラを1枚まで登場させる。〚カード名［比護隆佑］〛を登場させた場合、カードを1枚引く。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};

export const B10005: CardDef = {
  id: 'B10005', no: '1067/B10005', kind: 'character', names: ['灰原哀'], colors: ['青'], level: 7, ap: 5000, lp: 1,
  traits: ['少年探偵団', '科学者'], rarity: 'R', imageUrl: '1783904055282074.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B10005P: CardDef = { ...B10005, id: 'B10005P', no: '1067/B10005P', rarity: 'RP', imageUrl: '1783904055289604.jpg' };
