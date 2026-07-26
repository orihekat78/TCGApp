// CT-P10 B10036 鈴木園子 — rules: 05-turn-phases, 08-contact, 09-cutin-disguise, 15-abilities-effects, 17-icons, 21-declared-ability-cost, 22-qa-action-contact
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: { kind: 'atom', verb: 'sceneSetState', args: {
    uid: '$pick', state: 'active',
    target: { kind: 'pick', chooser: 'self', n: { min: 0, max: 1 }, query: { area: 'scene', side: 'self', filter: { kind: 'character', levelMin: 8 } } },
  } },
  description: '自分のターン終了時、自分の現場にいるレベル8以上のキャラを1枚まで選び、アクティブにする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene',
  condition: { kind: 'and', cs: [
    { kind: 'caseColor', color: ['緑', '白'], combine: 'and' },
    { kind: 'partnerColor', color: '白' },
    { kind: 'caseStatus', status: '解決編' },
  ] },
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', max: 1, bind: 'target' } },
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', max: 1, bind: 'actor', excludeSelf: true, state: ['sleep'] } },
    { kind: 'atom', verb: 'startContact', args: { actorUid: '$actor.uid', targetUid: '$target.uid' } },
  ] },
  description: '【事件緑＆白】【パートナー白】【解決編】【宣言】【スリープ】：相手の現場にいるキャラを1枚まで選び、自分の現場にいるこのキャラ以外のスリープ状態のキャラ1枚とのコンタクトを発生させる。（自分のキャラがアクションした側のキャラになる）',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/22-qa-action-contact.md'],
};

export const B10036: CardDef = {
  id: 'B10036', no: '1096/B10036', kind: 'character', names: ['鈴木園子'], colors: ['白'], level: 6, ap: 5000, lp: 1,
  traits: ['高校生', '鈴木財閥'], rarity: 'SR', imageUrl: '1783904116953499.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/22-qa-action-contact.md'],
};

export const B10036P: CardDef = { ...B10036, id: 'B10036P', no: '1096/B10036P', rarity: 'SRP', imageUrl: '1783904116960645.jpg' };
