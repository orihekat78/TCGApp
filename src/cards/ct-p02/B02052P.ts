// cards/ct-p02/B02052P トランプ銃 (パラレル)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md

import type { AbilityDef, CardDef } from '@/engine/types';

const abilities: AbilityDef[] = [
  { id: 'a1', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' }, effect: { kind: 'atom', verb: 'charSetCard', args: { player: 'self', fromSelf: true, n: 1, filter: { kind: 'character', trait: '怪盗' } } }, description: 'このイベントを自分の現場にいる〚特徴［怪盗］〛のキャラ1枚にセットする。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'] },
  { id: 'a2', type: 'triggered', scope: 'on-set-host', trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true } }, { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'stun', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } }] } }, description: 'このイベントがセットされているキャラは「自分のターン終了時、自分のデッキのカードを上から3枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、スタンさせる。」を持つ。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'] },
  { id: 'a3', type: 'triggered', scope: 'on-set-self', trigger: { hook: 'setcard:leave' }, condition: { kind: 'turn', player: 'opp' }, limit: { kind: 'turn', n: 1 }, setCardRemovalReplacement: { kind: 'move-to-own-scene', filter: { kind: 'character', trait: '怪盗' } }, description: '【相手ターン中】【ターン1】キャラにセットされているこのイベントがリムーブエリアに置かれるとき、代わりに自分の現場にいる〚特徴［怪盗］〛のキャラ1枚にセットしてもよい。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'] },
];

export const B02052P: CardDef = { id: 'B02052P', no: '0217/B02052P', kind: 'event', names: ['トランプ銃'], colors: ['白'], level: 5, traits: [], keywords: [], rarity: 'CP', imageUrl: '1721357250055590.jpg', abilities, ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'] };
