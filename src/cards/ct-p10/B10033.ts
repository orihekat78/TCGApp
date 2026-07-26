// CT-P10 B10033 ドゴ
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 20-color-and-switch.md
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-hand',
  condition: { kind: 'and', cs: [
    { kind: 'caseStatus', status: '解決編' },
    { kind: 'turn', player: 'self' },
    { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: ['服部平蔵', '遠山銀司郎'], kind: 'character' } }, nMin: 1 },
  ] },
  continuousModifier: { lvlDeltaInHand: -3 },
  description: '【解決編】【自分ターン中】自分の現場に〚カード名［服部平蔵］〛か〚［遠山銀司郎］〛がいる場合、手札にあるこのイベントはレベル－3される。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (payload: unknown, _state: GameState) => (payload as { kind?: unknown })?.kind === 'event-use' },
  condition: { kind: 'partnerColor', color: '緑' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 8000 }, cause: 'effect' } },
    { kind: 'atom', verb: 'charSetCard', args: { player: 'self', side: 'self', max: 1, filter: { kind: 'character', trait: '警察' }, fromDeckTop: true, faceUp: false } },
  ] },
  description: '【パートナー緑】AP8000以下のキャラを1枚まで選び、リムーブする。自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B10033: CardDef = {
  id: 'B10033', no: '1094/B10033', kind: 'event', names: ['ドゴ'], colors: ['緑'], level: 7,
  traits: [], rarity: 'C', imageUrl: '1783904116910908.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};
export const B10033P: CardDef = { ...B10033, id: 'B10033P', no: '1094/B10033P', rarity: 'CP', imageUrl: '1783904116917854.jpg' };
