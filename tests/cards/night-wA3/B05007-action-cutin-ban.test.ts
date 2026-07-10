// tests/cards/night-wA3/B05007-action-cutin-ban — engine A3 wave (2026-07-11)
//   新 primitive: setActionCutinBanFilter verb + turnState.actionCutinBanOppFilter + canCutIn live 照合。
//   B05007 妃英理 a2「【宣言】このターン中、自分の現場にいる〚特徴［毛利探偵事務所］〛のキャラがアクションしたとき、
//   アクション終了時まで相手は【カットイン】を使用できない」の core mechanic。
//   - filter 一致キャラのアクション中のみ相手 cutin を封じる (per-char flag 不要 = 将来登場キャラにも適用)。
//   - 「アクション終了時まで」= canCutIn がアクション中のみ呼ばれる → 自然に action スコープ。
//   ※ B05007 CARD 本体は a1 (登場時 optional sleep→手札から工藤新一/毛利探偵事務所 lvl6 登場+draw) 込みで
//      別途 authoring 要 → 本 probe は engine token を合成 exemplar で検証。
// rules: 07 (アクション) / 09 (カットイン) / 22・25 (発動タイミング Q&A).

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAtom } from '@/engine/effect/atom-handlers';
import { canCutIn } from '@/engine/flow/contact';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import type { AtomVerb, CardDef, ActionContext, EffectCtx, GameState } from '@/engine/types';

// カットイン札
const CUT: CardDef = {
  id: 'CUT', no: '9/CUT', kind: 'event', names: ['CUT'], colors: ['青'], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{ id: 'ci', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true }, effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'cutin', ruleRefs: [] }],
  ruleRefs: [],
};
function ch(id: string, traits: string[]): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const ctxOf = (side: 'self' | 'opp'): EffectCtx =>
  ({ source: { player: side, area: 'scene', cardId: 'B05007' }, bindings: {} } as EffectCtx);

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(CUT);
  registerCardDef(ch('MTJ', ['毛利探偵事務所'])); // filter 一致
  registerCardDef(ch('OTHER', ['探偵']));         // filter 非一致
});

// armer=self、actor は self 側キャラ。ax.byPlayer=self。opp=相手=cutin 制限対象。
function setup(actorCardId: string, actorUid = 'act'): { s: GameState; ax: ActionContext } {
  const s = createEmptyGameState();
  s.players.self.scene = [sceneChar(actorCardId, actorUid)];
  s.players.opp.hand = ['CUT'];
  s.players.self.hand = ['CUT'];
  const ax: ActionContext = { id: 'ax1', byUid: actorUid, byPlayer: 'self', target: { kind: 'char', uid: 'x' }, phase: 'guard-window', startedAt: { turn: 1, nano: 0 } };
  return { s, ax };
}

describe('setActionCutinBanFilter — filtered action-scoped cutin ban', () => {
  it('baseline (filter 未 arm): 両者カットイン可', () => {
    const { s, ax } = setup('MTJ');
    expect(canCutIn(s, ax, 'opp', 'CUT')).toBe(true);
    expect(canCutIn(s, ax, 'self', 'CUT')).toBe(true);
  });

  it('filter{毛利探偵事務所} arm + actor が毛利探偵事務所 → 相手(opp)は不可 / actor側(self)は可', () => {
    const { s, ax } = setup('MTJ');
    const s1 = produce(s, (d) => { runAtom(d, 'setActionCutinBanFilter' as AtomVerb, { player: 'self', filter: { trait: '毛利探偵事務所' } }, ctxOf('self')); });
    expect(canCutIn(s1, ax, 'opp', 'CUT'), '相手は使用不可').toBe(false);
    expect(canCutIn(s1, ax, 'self', 'CUT'), 'actor側は可').toBe(true);
  });

  it('filter arm でも actor が非一致 (探偵) → 相手カットイン可 (filter 一致キャラのアクション時のみ)', () => {
    const { s, ax } = setup('OTHER');
    const s1 = produce(s, (d) => { runAtom(d, 'setActionCutinBanFilter' as AtomVerb, { player: 'self', filter: { trait: '毛利探偵事務所' } }, ctxOf('self')); });
    expect(canCutIn(s1, ax, 'opp', 'CUT')).toBe(true);
  });

  it('turn:start (resetTurnFlags) で filter 清掃 → 相手カットイン再び可', () => {
    const { s, ax } = setup('MTJ');
    const s1 = produce(s, (d) => { runAtom(d, 'setActionCutinBanFilter' as AtomVerb, { player: 'self', filter: { trait: '毛利探偵事務所' } }, ctxOf('self')); });
    expect(canCutIn(s1, ax, 'opp', 'CUT')).toBe(false);
    const s2 = produce(s1, (d) => { mutate.flag.resetTurnFlags(d, 'self'); });
    expect(canCutIn(s2, ax, 'opp', 'CUT'), 'ターン境界で解除').toBe(true);
  });

  it('将来登場キャラにも適用: filter arm 後に登場した毛利探偵事務所キャラのアクションでも封じる', () => {
    const { s } = setup('OTHER'); // 初期 actor は非一致
    const s1 = produce(s, (d) => {
      runAtom(d, 'setActionCutinBanFilter' as AtomVerb, { player: 'self', filter: { trait: '毛利探偵事務所' } }, ctxOf('self'));
      mutate.scene.enter(d, 'self', 'MTJ', {}); // arm 後に新規登場
    });
    const newUid = s1.players.self.scene.find((c) => c.cardId === 'MTJ')!.uid;
    const ax2: ActionContext = { id: 'ax2', byUid: newUid, byPlayer: 'self', target: { kind: 'char', uid: 'x' }, phase: 'guard-window', startedAt: { turn: 1, nano: 0 } };
    expect(canCutIn(s1, ax2, 'opp', 'CUT'), '後発登場キャラのアクションでも相手不可').toBe(false);
  });

  it('owner=opp pin: armer=opp, actor=opp の毛利探偵事務所 → 相手(self)が不可 / opp は可', () => {
    const s = createEmptyGameState();
    s.players.opp.scene = [sceneChar('MTJ', 'oact')];
    s.players.self.hand = ['CUT'];
    s.players.opp.hand = ['CUT'];
    const ax: ActionContext = { id: 'axo', byUid: 'oact', byPlayer: 'opp', target: { kind: 'char', uid: 'x' }, phase: 'guard-window', startedAt: { turn: 1, nano: 0 } };
    const s1 = produce(s, (d) => { runAtom(d, 'setActionCutinBanFilter' as AtomVerb, { player: 'self', filter: { trait: '毛利探偵事務所' } }, ctxOf('opp')); });
    expect(canCutIn(s1, ax, 'self', 'CUT'), 'opp の相手=self は不可').toBe(false);
    expect(canCutIn(s1, ax, 'opp', 'CUT'), 'opp(actor側)は可').toBe(true);
  });
});
