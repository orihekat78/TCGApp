import { it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { drainAiEffectPicks, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { PR279 } from '@/cards/pr-01/PR279';
import type { CardDef, GameState } from '@/engine/types';
const FILL: CardDef = { id:'FILL', no:'FILL', kind:'character', names:['FILL'], colors:['黄'], level:3, ap:3000, lp:1, traits:[], keywords:[], rarity:'C', imageUrl:'', abilities:[], ruleRefs:[] };
beforeEach(() => { _resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); _clearPendingEffectPickQueue(); [PR279, FILL].forEach(registerCardDef); registerTriggeredListener(); (globalThis as any).__humanPlayerSide = null; });
it('dbg2', () => {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.opp.evidence = [{ cardId: 'FILL', faceUp: false }, { cardId: 'FILL', faceUp: false }];
  s.players.self.remove = ['PR279'];
  const r = produce(s, (d: GameState) => {
    runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'PR279', target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' } } } as never,
      { source: { cardId: 'FILL', uid: 'test:src', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as never);
    for (let i = 0; i < 4; i++) { runAllUntilEmpty(d); _drainAllEffectPicksForTest(d); drainAiEffectPicks(d); }
  });
  console.log('LOG:', JSON.stringify((r.log as any[]).map(l=>l.action+':'+(l.result??'')+':'+(l.target??'')))); console.log('EV:', JSON.stringify(r.players.opp.evidence));
  expect(true).toBe(true);
});
