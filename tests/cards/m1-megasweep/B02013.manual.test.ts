// m1-megasweep probe — B02013 ターボエンジン付きスケートボード (event, engine変更0)
//
// 印字 (ground truth, payloads/B02013.json fullTexts):
//   effect(a1): このイベントを自分の現場にいるレベル7以下の【青】のキャラ1枚にセットする。
//   effect(a2): このイベントがセットされているキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//   hirameki(a3): 【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
//
// novel 句 → engine 実評価 (全て production dispatch):
//   a1 charSetCard{fromSelf,n:1,filter:{青,levelMax:7,character}}: hook=effect:declared(event-use) triggered。
//       card-probe-harness の event-use drive (handUseCard→runAllUntilEmpty) で発火。使用イベントは remove へ
//       着地後、fromSelf short-form pick で host を選び remove→host に **faceUp** セット (atom-handlers/char.ts
//       fromSelf branch)。filter/side は paShortFormAwait 経由の候補列挙で gate。
//   a2 on-set-host grantKeywords['突撃']: read/char.ts keywords() が faceUp setCards の scope:'on-set-host'
//       continuous grantKeywords を host に合算する rider READ (char.ts:388-412)。scenario 1 の set 後、
//       returned state で readChar.keywords(host) が '突撃' を含むことで実評価を踏む。
//   a3 handAddFromRemove{fromSelf,player:self}: hook=evidence:remove-by-action optional (ヒラメキ)。実 emit で
//       triggered listener が pendingHirameki を set → effect を resolveEffectPicks+runEffect で解決。
//       ctx.source.cardId(=B02013) を owner の remove から lastIndexOf で引き hand へ (core.ts fromSelf branch)。
//
// off-variant: (a1) filter に合う host 不在 → 0 候補 = chainStepNoApply、prompt 不出・イベントは remove 残留。
//              (a3) 非 B02013 証拠リムーブ → pendingHirameki 不 set (a3 発火せず)。
// decoy: (a1) 赤 host / lv8 host / opp host が host 候補から除外 (candidatesExclude)。
//        (a2) set を持たない同側 host は '突撃' を持たない。
// BUG-174 reversal: (a3) owner='opp' で B02013 は opp.remove→opp.hand、self 側不変 (player:self は source 相対)。
// rules: 13 (突撃) / 15 / 16 (セット=faceUp READ / 離場でリムーブ) / 17 / 10 (ヒラメキ)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { ProbeScenario } from '../../helpers/card-probe-harness';
import { char as readChar } from '@/engine/read/char';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef, def } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { B02013 } from '@/cards/ct-p02/B02013';
import type { CardDef, GameState, EffectCtx, SceneCharacter } from '@/engine/types';

type Side = 'self' | 'opp';

function chDef(id: string, colors: string[], level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors, level, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function evDef(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['青'], level: 3,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const HOST = chDef('__HOST', ['青'], 3);   // 青 lv3 → 唯一の有効 host
const RED = chDef('__RED', ['赤'], 3);     // decoy: 色不一致
const L8 = chDef('__L8', ['青'], 8);       // decoy: レベル8 (levelMax:7 超過)
const OPP = chDef('__OPP', ['青'], 3);     // decoy: 相手側 (side:self)
const FIXTURES: CardDef[] = [HOST, RED, L8, OPP];

// ─────────────────────────────────────────────────────────────────────────────
// a1 (charSetCard fromSelf) + a2 (on-set-host 突撃 grant) — production event-use 経路
// ─────────────────────────────────────────────────────────────────────────────
describe('B02013 a1/a2 — event-use で自現場の【青】lv7以下キャラにセット → host が〚突撃〛を得る', () => {
  it('happy: __HOST に faceUp セット / 赤・lv8・opp は候補除外 / host が突撃を得る / set 無し host は突撃なし', () => {
    const sc: ProbeScenario = {
      name: 'B02013 a1 set + a2 突撃 grant',
      setup: {
        selfScene: [
          { cardId: '__HOST', uid: 'u-host', state: 'active' },
          { cardId: '__RED', uid: 'u-red', state: 'active' },   // decoy 色
          { cardId: '__L8', uid: 'u-l8', state: 'active' },     // decoy level
        ],
        oppScene: [{ cardId: '__OPP', uid: 'u-opp', state: 'active' }], // decoy side
        hand: ['B02013'],
        caseColors: ['青'],
        fileCount: 7,
      },
      drive: { kind: 'event-use', cardId: 'B02013' },
      script: [{ pickCardId: '__HOST' }],
      expect: [
        { kind: 'candidatesExclude', pickIndex: 0, cardId: '__RED' },
        { kind: 'candidatesExclude', pickIndex: 0, cardId: '__L8' },
        { kind: 'candidatesExclude', pickIndex: 0, cardId: '__OPP' },
        // 使用イベントは host に移動 → remove からは消える
        { kind: 'zone', cardId: 'B02013', zone: 'remove', side: 'self', present: false },
      ],
    };
    const s = runCardScenario(B02013, FIXTURES, sc);

    // a1: B02013 が __HOST に **faceUp** セットされている (rules/16)
    const host = s.players.self.scene.find((c) => c.uid === 'u-host')!;
    expect(host.setCards.some((e) => e.cardId === 'B02013' && e.faceUp === true), 'B02013 が host に faceUp セット').toBe(true);

    // a2: on-set-host rider が host に〚突撃〛を付与 (read/char.ts keywords rider READ)
    expect(readChar.keywords(s, 'u-host'), 'host は〚突撃〛を得る').toContain('突撃');

    // a2 decoy: set を持たない同側 host (__RED) は〚突撃〛を持たない
    expect(readChar.keywords(s, 'u-red'), 'set 無しの同側 host は突撃を持たない').not.toContain('突撃');
  });

  it('off-variant: filter に合う host 不在 (赤のみ) → セット不成立、イベントは remove に残留・prompt 不出', () => {
    const sc: ProbeScenario = {
      name: 'B02013 a1 host-absent',
      setup: {
        selfScene: [{ cardId: '__RED', uid: 'u-red2', state: 'active' }], // 青 host 無し
        hand: ['B02013'],
        caseColors: ['青'],
        fileCount: 7,
      },
      drive: { kind: 'event-use', cardId: 'B02013' },
      script: [],
      expect: [
        { kind: 'noPromptSurfaced' }, // 0 候補 → chainStepNoApply、pick は surface しない
        { kind: 'zone', cardId: 'B02013', zone: 'remove', side: 'self', present: true }, // 使用後 remove 着地のまま
      ],
    };
    const s = runCardScenario(B02013, FIXTURES, sc);
    const red = s.players.self.scene.find((c) => c.uid === 'u-red2')!;
    expect(red.setCards.length, 'filter 外 host にはセットされない').toBe(0);
    expect(readChar.keywords(s, 'u-red2'), 'セット無し → 突撃なし').not.toContain('突撃');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// a3 (ヒラメキ: handAddFromRemove fromSelf) — 実 emit → pending → effect 解決
// ─────────────────────────────────────────────────────────────────────────────
const PLAINEV = evDef('__PLAINEV'); // hirameki を持たないイベント (a3 off-variant 用)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerCardDef(B02013);
  registerCardDef(PLAINEV);
  for (const c of FIXTURES) registerCardDef(c);
  registerTriggeredListener();
});

// 実 emit 経路: evidence:remove-by-action → pendingHirameki set → a3 効果を production resolver で解決
function fireHirameki(evidenceOwner: Side, removedCardId: string, setup: (s: GameState) => void): {
  after: GameState; pending: ReturnType<typeof _drainPendingHirameki>;
} {
  const attacker: Side = evidenceOwner === 'self' ? 'opp' : 'self';
  let s = produce(createEmptyGameState(), (d) => {
    d.turn = { number: 4, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    setup(d);
  });
  s = produce(s, (d) => {
    event.emit(
      d,
      'evidence:remove-by-action',
      { player: evidenceOwner, ev: { cardId: removedCardId } },
      { player: attacker, uid: `${attacker}-attacker` },
    );
  });
  const pending = _drainPendingHirameki();
  if (!pending) return { after: s, pending };
  // fire: a3 効果 (handAddFromRemove fromSelf) を production resolver で解決
  const a3 = def.card('B02013')!.abilities.find((a) => a.id === 'a3')!.effect!;
  const ctx = {
    source: { player: pending.player, cardId: pending.cardId, area: 'evidence', abilityId: pending.abilityId },
    bindings: {},
  } as unknown as EffectCtx;
  const after = produce(s, (d) => {
    const walked = resolveEffectPicks(d, a3 as never, ctx, { byPlayer: pending.player, humanChooser: false, source: { cardId: 'B02013', abilityId: 'a3' } });
    runEffect(d, walked as never, ctx);
  });
  return { after, pending };
}

describe('B02013 a3 — ヒラメキ: 証拠からリムーブされたら手札に加える', () => {
  it('happy (owner=self): 証拠リムーブされた B02013 が self.remove から self.hand へ移動', () => {
    const { after, pending } = fireHirameki('self', 'B02013', (s) => {
      s.players.self.remove = ['B02013']; // アクション[事件]で証拠リムーブ → remove へ着地済み
      s.players.self.hand = [];
    });
    expect(pending, 'a3 が pending として発火').not.toBeNull();
    expect(pending!.cardId).toBe('B02013');
    expect(pending!.player).toBe('self');
    expect(pending!.abilityId).toBe('a3');
    expect(after.players.self.hand, 'B02013 が手札に加わる').toContain('B02013');
    expect(after.players.self.remove, 'B02013 は remove から消える').not.toContain('B02013');
  });

  it('reversal pin (BUG-174, owner=opp): B02013 は opp.remove→opp.hand、self 側は不変 (player:self は source 相対)', () => {
    const { after, pending } = fireHirameki('opp', 'B02013', (s) => {
      s.players.opp.remove = ['B02013'];
      s.players.opp.hand = [];
      s.players.self.remove = ['DECOY_SELF']; // self 側 decoy — 誤って触られないこと
      s.players.self.hand = [];
    });
    expect(pending!.player, 'ヒラメキ所有者は証拠所有者 (opp)').toBe('opp');
    expect(after.players.opp.hand, 'opp.hand に B02013').toContain('B02013');
    expect(after.players.opp.remove, 'opp.remove から消える').not.toContain('B02013');
    expect(after.players.self.remove, 'self 側 remove は不変 (side ハードコードなし)').toEqual(['DECOY_SELF']);
    expect(after.players.self.hand, 'self.hand は空のまま').toEqual([]);
  });

  it('off-variant: 非 B02013 の証拠 (ヒラメキ無し) がリムーブされても a3 は発火しない', () => {
    const { pending } = fireHirameki('self', '__PLAINEV', (s) => {
      s.players.self.remove = ['__PLAINEV'];
    });
    expect(pending, 'ヒラメキを持たない証拠では pending 不 set').toBeNull();
  });
});
