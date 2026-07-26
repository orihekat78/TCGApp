// CT-P10 B10013 比護隆佑 — rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '青' },
  effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', player: 'self', fromDeckTop: true, faceUp: false } },
  description: '【パートナー青】【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', cost: { kind: 'sleepSelf' },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', max: 1, bind: '$host', excludeSelf: true, filter: { kind: 'character', trait: 'サッカー選手', hasFaceDownSetCards: false } } },
    { kind: 'moveSetCard', hostUid: '$self', face: 'down', destination: { area: 'scene', hostUid: '$host.uid' } },
  ] },
  description: '【宣言】【スリープ】：自分の現場にいる裏向きのカードがセットされていない〚特徴［サッカー選手］〛のキャラを1枚まで選び、このキャラにセットされている裏向きのカードを1枚移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 2 },
  cost: { kind: 'removeSetCard', n: 1, hostSelf: true },
  effect: { kind: 'choice', chooser: 'self', options: [
    { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
    { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character' }, state: 'sleep' } },
  ] },
  description: '【宣言】【ターン2】〚このキャラに裏向きでセットされているカードを1枚リムーブする〛：以下から1つ選んで行う。・ターン終了時までこのキャラは〚突撃〛を持つ。・キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10013: CardDef = {
  id: 'B10013', no: '1075/B10013', kind: 'character', names: ['比護隆佑'], colors: ['青'], level: 6, ap: 6000, lp: 0,
  traits: ['サッカー選手'], keywords: [], rarity: 'C', imageUrl: '1783904055360762.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10013P: CardDef = { ...B10013, id: 'B10013P', no: '1075/B10013P', rarity: 'CP', imageUrl: '1783904094955478.jpg' };
