import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({ color: '青', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2', type: 'continuous', scope: 'on-scene',
  continuousModifier: { grantTraits: ['サッカー選手'] },
  description: '現場にいるこのキャラは〚特徴［サッカー選手］〛を持つ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '青' },
  effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
  description: '【パートナー青】【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

const a4: AbilityDef = {
  id: 'a4', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'action:end', selfOnly: true },
  effect: {
    kind: 'choice', chooser: 'self', options: [
      { kind: 'moveSetCard', hostUid: '$self', face: 'down', destination: { area: 'hand' } },
      { kind: 'chain', steps: [
        { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', max: 1, bind: '$host', filter: { kind: 'character', trait: 'サッカー選手', hasFaceDownSetCards: false } } },
        { kind: 'moveSetCard', hostUid: '$self', face: 'down', destination: { area: 'scene', hostUid: '$host.uid' } },
      ] },
    ],
  },
  description: '【ターン1】このキャラのアクション終了時、以下から1つ選んで行う。・このキャラに裏向きでセットされているカードを1枚手札に加える。・自分の現場にいる裏向きのカードがセットされていない〚特徴［サッカー選手］〛のキャラを1枚まで選び、このキャラにセットされている裏向きのカードを1枚移す。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

export const B10003: CardDef = {
  id: 'B10003', no: '1065/B10003', kind: 'character', names: ['工藤新一'], colors: ['青'], level: 8, ap: 8000, lp: 2,
  traits: ['探偵', '高校生'], rarity: 'SR', imageUrl: '1783904055254683.jpg', abilities: [a1, a2, a3, a4],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B10003P: CardDef = { ...B10003, id: 'B10003P', no: '1065/B10003P', rarity: 'SRP', imageUrl: '1783904055261929.jpg' };
