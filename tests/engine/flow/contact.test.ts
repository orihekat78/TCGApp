// Phase 4 Group B Task 4.5 — flow.contact (cutIn/disguise/pass/judge/computeOrder)
// rules: 08-contact.md, 09-cutin-disguise.md, 23-qa-disguise-cutin.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  canCutIn,
  cutIn,
  canDisguise,
  disguise,
  pass,
  judge,
  computeOrder,
} from '@/engine/flow/contact';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState, ActionContext } from '@/engine/types';

function makeCard(
  id: string,
  opts: Partial<CardDef> & { ciOrDis?: 'cutin' | 'disguise' | 'both'; disguiseCondition?: unknown } = {},
): CardDef {
  const abilities: unknown[] = opts.abilities ?? [];
  // 2026-05-27 Option C: icon-cutin → triggered+optional. fixture も新 shape で push。
  if (opts.ciOrDis === 'cutin' || opts.ciOrDis === 'both') {
    abilities.push({
      type: 'triggered',
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    });
  }
  if (opts.ciOrDis === 'disguise' || opts.ciOrDis === 'both') {
    // 変装ゲート条件 (【事件白】【FILE6】等) は icon-disguise ability の condition に格納 (canDisguise が評価)。
    abilities.push({ id: 'd1', type: 'icon-disguise', condition: opts.disguiseCondition });
  }
  return {
    id,
    no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000,
    lp: opts.lp ?? 1000,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities,
    ruleRefs: opts.ruleRefs ?? [],
  };
}

function setupScene(opts: {
  selfAP?: number;
  oppAP?: number;
  selfHand?: string[];
  oppHand?: string[];
  contactImmune?: boolean;
}): { s: GameState; ax: ActionContext; selfUid: string; oppUid: string } {
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('Atk', { ap: opts.selfAP ?? 2000 }));
  registerCardDef(makeCard('Def', { ap: opts.oppAP ?? 1000 }));
  registerCardDef(makeCard('CIcard', { ciOrDis: 'cutin', colors: ['青'] /* 異色 */ }));
  registerCardDef(makeCard('DisCard', { ciOrDis: 'disguise', ap: 1500, lp: 500 }));
  registerCardDef(makeCard('Plain', {}));
  const initial = createEmptyGameState();
  let selfUid = '';
  let oppUid = '';
  const s = produce(initial, draft => {
    const a = mutate.scene.enter(draft, 'self', 'Atk', {});
    selfUid = a.uid;
    const d = mutate.scene.enter(draft, 'opp', 'Def', {});
    oppUid = d.uid;
    if (opts.selfHand) mutate.hand.add(draft, 'self', opts.selfHand);
    if (opts.oppHand) mutate.hand.add(draft, 'opp', opts.oppHand);
    if (opts.contactImmune) {
      mutate.char.setTurnEffect(draft, d.uid, 'contactImmune', true);
    }
  });
  const ax: ActionContext = {
    id: 'test-ax-1',
    byUid: selfUid,
    byPlayer: 'self',
    target: { kind: 'char', uid: oppUid },
    phase: 'action-1',
    cutInUsed: {},
    startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: selfUid, aAP: opts.selfAP ?? 2000, bUid: oppUid, bAP: opts.oppAP ?? 1000 },
    contactImmune: opts.contactImmune ?? false,
  };
  return { s, ax, selfUid, oppUid };
}

describe('engine.flow.contact.cutIn', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('cutIn: card moves hand → remove, cutInUsed=true', () => {
    const { s, ax } = setupScene({ selfHand: ['CIcard'] });
    const out = produce(s, draft => {
      cutIn(draft, ax, 'self', 'CIcard');
    });
    expect(out.players.self.hand).not.toContain('CIcard');
    expect(out.players.self.remove).toContain('CIcard');
    expect(ax.cutInUsed?.self).toBe(true);
  });

  it('canCutIn false on second cutIn for same player same contact', () => {
    const { s, ax } = setupScene({ selfHand: ['CIcard'] });
    produce(s, draft => {
      cutIn(draft, ax, 'self', 'CIcard');
    });
    // 同 ax で 2 回目
    expect(canCutIn(s, ax, 'self', 'CIcard')).toBe(false);
  });

  it('canCutIn true with color mismatch (色制限なし rules/09)', () => {
    // CIcard は colors: ['青'] (異色) だが、色制限はない
    const { s, ax } = setupScene({ selfHand: ['CIcard'] });
    expect(canCutIn(s, ax, 'self', 'CIcard')).toBe(true);
  });

  it('canCutIn false if card not in hand', () => {
    const { s, ax } = setupScene({ selfHand: [] });
    expect(canCutIn(s, ax, 'self', 'CIcard')).toBe(false);
  });

  it('canCutIn false if cardId is not a cutin card', () => {
    const { s, ax } = setupScene({ selfHand: ['Plain'] });
    expect(canCutIn(s, ax, 'self', 'Plain')).toBe(false);
  });
});

describe('engine.flow.contact.disguise', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('disguise: original cardId goes to deck bottom; new cardId in scene char (same uid)', () => {
    const { s, ax, selfUid } = setupScene({ selfHand: ['DisCard'] });
    const out = produce(s, draft => {
      disguise(draft, ax, 'self', 'DisCard');
    });
    expect(out.players.self.deck[out.players.self.deck.length - 1]).toBe('Atk');
    const c = out.players.self.scene.find(c => c.uid === selfUid);
    expect(c?.cardId).toBe('DisCard'); // uid 維持、cardId 変更
    expect(out.players.self.hand).not.toContain('DisCard');
  });

  it('disguise emits disguise:into with { uid, fromCardId, newCardId, player }', () => {
    // engine additive wave-18 (2026-07-03): payload に player を追加 (白鳥 triggerPlayerIs 用、cutin:used と同型)。
    const captured: { uid: string; fromCardId: string; newCardId: string; player: string }[] = [];
    event.on('disguise:into', (_s, payload) => {
      captured.push(payload as typeof captured[number]);
    });
    const { s, ax, selfUid } = setupScene({ selfHand: ['DisCard'] });
    produce(s, draft => {
      disguise(draft, ax, 'self', 'DisCard');
    });
    expect(captured.length).toBe(1);
    // engine mega-wave W3 (2026-07-03, r51): payload に replacedChar (入替え元 snapshot、sentinel uid) が
    // additive 追加 → 基本 4 field は toMatchObject で不変 pin、replacedChar は cardId/sentinel を確認。
    expect(captured[0]).toMatchObject({ uid: selfUid, fromCardId: 'Atk', newCardId: 'DisCard', player: 'self' });
    const rc = (captured[0] as unknown as { replacedChar?: { cardId: string; uid: string } }).replacedChar;
    expect(rc?.cardId).toBe('Atk');
    expect(rc?.uid).toBe(`${selfUid}::disguise-replaced`);
  });

  it('canDisguise false if cardId not in hand', () => {
    const { s, ax } = setupScene({ selfHand: [] });
    expect(canDisguise(s, ax, 'self', 'DisCard')).toBe(false);
  });

  it('canDisguise false if card is not a disguise card', () => {
    const { s, ax } = setupScene({ selfHand: ['Plain'] });
    expect(canDisguise(s, ax, 'self', 'Plain')).toBe(false);
  });

  // engine-extension (2026-06-06 タスクC): 変装ゲート条件 (rules/09 §変装, rules/17 §条件アイコン)。
  // icon-disguise ability の condition を canDisguise が評価し、未達なら変装不可。
  it('canDisguise respects 【事件白】 condition (caseColor)', () => {
    _resetUidCounter();
    resetDefRegistry();
    registerCardDef(makeCard('Atk', { ap: 2000 }));
    registerCardDef(makeCard('Def', { ap: 1000 }));
    registerCardDef(makeCard('DisCaseWhite', {
      ciOrDis: 'disguise',
      disguiseCondition: { kind: 'caseColor', color: '白' },
    }));
    const initial = createEmptyGameState();
    let selfUid = '';
    let oppUid = '';
    const base = produce(initial, draft => {
      selfUid = mutate.scene.enter(draft, 'self', 'Atk', {}).uid;
      oppUid = mutate.scene.enter(draft, 'opp', 'Def', {}).uid;
      mutate.hand.add(draft, 'self', ['DisCaseWhite']);
    });
    const ax: ActionContext = {
      id: 'ax', byUid: selfUid, byPlayer: 'self', target: { kind: 'char', uid: oppUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: selfUid, aAP: 2000, bUid: oppUid, bAP: 1000 }, contactImmune: false,
    };
    // 事件 白 → 変装可
    const sWhite = produce(base, draft => { draft.players.self.case.colors = ['白']; });
    expect(canDisguise(sWhite, ax, 'self', 'DisCaseWhite'), '事件白 → 変装可').toBe(true);
    // 事件 赤 (白でない) → 変装不可
    const sRed = produce(base, draft => { draft.players.self.case.colors = ['赤']; });
    expect(canDisguise(sRed, ax, 'self', 'DisCaseWhite'), '事件白でない → 変装不可').toBe(false);
  });

  it('canDisguise respects 【FILE6】 condition (fileAtLeast)', () => {
    _resetUidCounter();
    resetDefRegistry();
    registerCardDef(makeCard('Atk', { ap: 2000 }));
    registerCardDef(makeCard('Def', { ap: 1000 }));
    registerCardDef(makeCard('DisFile6', {
      ciOrDis: 'disguise',
      disguiseCondition: { kind: 'fileAtLeast', n: 6 },
    }));
    const initial = createEmptyGameState();
    let selfUid = '';
    let oppUid = '';
    const base = produce(initial, draft => {
      selfUid = mutate.scene.enter(draft, 'self', 'Atk', {}).uid;
      oppUid = mutate.scene.enter(draft, 'opp', 'Def', {}).uid;
      mutate.hand.add(draft, 'self', ['DisFile6']);
    });
    const ax: ActionContext = {
      id: 'ax', byUid: selfUid, byPlayer: 'self', target: { kind: 'char', uid: oppUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: selfUid, aAP: 2000, bUid: oppUid, bAP: 1000 }, contactImmune: false,
    };
    const fb = { type: 'card-back' as const, cardId: 'Atk' };
    // FILE 5 枚 → 変装不可
    const sFile5 = produce(base, draft => { draft.players.self.file = [fb, fb, fb, fb, fb]; });
    expect(canDisguise(sFile5, ax, 'self', 'DisFile6'), 'FILE5 → 変装不可').toBe(false);
    // FILE 6 枚 → 変装可
    const sFile6 = produce(base, draft => { draft.players.self.file = [fb, fb, fb, fb, fb, fb]; });
    expect(canDisguise(sFile6, ax, 'self', 'DisFile6'), 'FILE6 → 変装可').toBe(true);
  });
});

describe('engine.flow.contact.judge', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('aAP > bAP → defender removed', () => {
    const { s, ax, oppUid } = setupScene({ selfAP: 2000, oppAP: 1000 });
    const out = produce(s, draft => {
      const r = judge(draft, ax);
      expect(r.defenderRemoved).toBe(true);
      expect(r.attackerRemoved).toBe(false);
    });
    expect(out.players.opp.scene.find(c => c.uid === oppUid)).toBeUndefined();
  });

  it('aAP === bAP → defender removed (rules/08)', () => {
    const { s, ax, oppUid } = setupScene({ selfAP: 1500, oppAP: 1500 });
    const out = produce(s, draft => {
      const r = judge(draft, ax);
      expect(r.defenderRemoved).toBe(true);
    });
    expect(out.players.opp.scene.find(c => c.uid === oppUid)).toBeUndefined();
  });

  it('aAP < bAP → no removal', () => {
    const { s, ax, oppUid } = setupScene({ selfAP: 500, oppAP: 2000 });
    const out = produce(s, draft => {
      const r = judge(draft, ax);
      expect(r.defenderRemoved).toBe(false);
    });
    expect(out.players.opp.scene.find(c => c.uid === oppUid)).toBeDefined();
  });

  it('contactImmune defender → no removal even if aAP >= bAP', () => {
    const { s, ax, oppUid } = setupScene({ selfAP: 2000, oppAP: 1000, contactImmune: true });
    const out = produce(s, draft => {
      const r = judge(draft, ax);
      expect(r.defenderRemoved).toBe(false);
    });
    expect(out.players.opp.scene.find(c => c.uid === oppUid)).toBeDefined();
  });

  it('attacker never removed even if defenderAP > attackerAP', () => {
    const { s, ax, selfUid } = setupScene({ selfAP: 500, oppAP: 2000 });
    const out = produce(s, draft => {
      const r = judge(draft, ax);
      expect(r.attackerRemoved).toBe(false);
    });
    expect(out.players.self.scene.find(c => c.uid === selfUid)).toBeDefined();
  });

  it('judge emits contact:judge with { winner, loser }', () => {
    const captured: { winner: string; loser: string }[] = [];
    event.on('contact:judge', (_s, payload) => {
      captured.push(payload as typeof captured[number]);
    });
    const { s, ax, selfUid, oppUid } = setupScene({ selfAP: 2000, oppAP: 1000 });
    produce(s, draft => {
      judge(draft, ax);
    });
    expect(captured.length).toBe(1);
    expect(captured[0]).toEqual({ winner: selfUid, loser: oppUid });
  });
});

describe('engine.flow.contact.computeOrder', () => {
  it('aAP < bAP → attacker first', () => {
    const r = computeOrder(500, 2000, { aUid: 'A', bUid: 'B' });
    expect(r.firstUid).toBe('A');
    expect(r.secondUid).toBe('B');
  });

  it('aAP > bAP → defender first', () => {
    const r = computeOrder(2000, 500, { aUid: 'A', bUid: 'B' });
    expect(r.firstUid).toBe('B');
    expect(r.secondUid).toBe('A');
  });

  it('equal AP + attacker is turn-player → defender (non-turn) first (rules/08)', () => {
    const r = computeOrder(1000, 1000, { aUid: 'A', bUid: 'B' });
    expect(r.firstUid).toBe('B');
    expect(r.secondUid).toBe('A');
  });
});

describe('engine.flow.contact.pass', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('pass: no-op + log appended', () => {
    const { s, ax } = setupScene({});
    const out = produce(s, draft => {
      pass(draft, ax, 'self');
    });
    expect(out.log.some(e => e.action === 'contact-pass')).toBe(true);
  });
});
