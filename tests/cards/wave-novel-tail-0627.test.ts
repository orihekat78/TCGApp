// card wave novel-tail-0627 — green候補 6枚 (engine変更0) 実機/構造検証。
// 対象: D07018 ジン / B02008 阿笠博士 / B07024 ハチ / B02073 上原由衣 / D02005 遠山和葉 / PR036 遠山和葉(clone)。
// すべて certify (grounding) + opus 敵対 verify (ok:true) 通過。D02005/PR036 は a2 hirameki を uid:'$pick'
// explicit form に補修 (BUG-140、短縮形は hiramekiResolve auto-resolve で no-op) → 再 verify ok。
//
// 検証2層 (「画面処理 = カードテキスト文言」1対1):
//   A. 構造 1対1: 各 ability の DSL args (hook/side/filter/level/delta/scope/state/kw/cost/optional/limit/uid:$pick)
//      が公式テキストの語と 1 対 1 で一致 (条件外 filter 値・side・量指定子の取り違えを固定)。
//   B. end-to-end trigger gating: B02008 a1 (enter+side:self+trait少年探偵団) を decoy で発火/非発火を実機固定。
import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { endTurn } from '@/engine/flow/turn';
import { registerAll } from '@/cards/index';
import { produce } from '@/engine/produce';
import { D07018 } from '@/cards/ct-d07/D07018';
import { B02008 } from '@/cards/ct-p02/B02008';
import { B07024 } from '@/cards/ct-p07/B07024';
import { B02073 } from '@/cards/ct-p02/B02073';
import { D02005 } from '@/cards/ct-d02/D02005';
import { PR036 } from '@/cards/pr-01/PR036';
import type { GameState, CardDef, EffectDescriptor, AbilityDef } from '@/engine/types';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: 'character', names: o.names ?? [o.id], colors: o.colors ?? ['緑'],
    level: o.level ?? 1, ap: o.ap ?? 1000, lp: o.lp ?? 1000, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  } as CardDef;
}
function ab(card: CardDef, id: string): AbilityDef {
  return card.abilities.find((a) => a.id === id)! as AbilityDef;
}
// effect tree を walk して最初の指定 verb の atom args を返す。
function findArgs(eff: EffectDescriptor | undefined, verb: string): Record<string, unknown> | null {
  if (!eff || typeof eff !== 'object') return null;
  const e = eff as Record<string, unknown>;
  if (e.kind === 'atom' && e.verb === verb) return e.args as Record<string, unknown>;
  for (const k of ['effect', 'then', 'else']) {
    const r = findArgs(e[k] as EffectDescriptor | undefined, verb);
    if (r) return r;
  }
  for (const s of (e.steps as EffectDescriptor[] | undefined) ?? []) {
    const r = findArgs(s, verb);
    if (r) return r;
  }
  return null;
}

// ───────────────────────── A. 構造 1対1 ─────────────────────────
describe('wave novel-tail-0627 — 構造 1対1 (DSL args = カードテキスト文言)', () => {
  it('D07018 ジン: a1 contact:start+selfOnly+自分ターン中+bUid Lv6以下→sceneRemove / a2 ヒラメキ draw1', () => {
    const a1 = ab(D07018, 'a1');
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'contact:start', selfOnly: true });
    // 「レベル6以下のキャラと」= 相手(bUid) を levelMax:6 で gate
    expect(a1.trigger.matcherCondition).toMatchObject({ kind: 'triggerCharMatches', payloadKey: 'bUid', filter: { levelMax: 6 } });
    // 「【自分ターン中】」
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    // 「そのキャラをリムーブする」= contact 相手を除去
    expect(findArgs(a1.effect, 'sceneRemove')).toMatchObject({ uid: '$trigger.bUid' });
    // a2 ヒラメキ「カードを1枚引く」
    const a2 = ab(D07018, 'a2');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(findArgs(a2.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
  });

  it('B02008 阿笠博士: a1 enter+self+少年探偵団+ターン1→AP-1000(turn,1枚まで,両側) / a2 ヒラメキ remove→hand', () => {
    const a1 = ab(B02008, 'a1');
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a1.trigger).toMatchObject({ hook: 'enter' });
    expect(a1.trigger.matcherCondition).toMatchObject({ kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { trait: '少年探偵団' } });
    // 「キャラを1枚まで選び、ターン終了時までAP-1000」= 無条件キャラ(両側), max1(0可), turn
    expect(findArgs(a1.effect, 'charModifyAP')).toMatchObject({ max: 1, side: 'either', delta: -1000, scope: 'turn' });
    const a2 = ab(B02008, 'a2');
    expect(findArgs(a2.effect, 'handAddFromRemove')).toMatchObject({ player: 'self', max: 1, filter: { kind: 'character', trait: '少年探偵団' } });
  });

  it('B07024 ハチ: a1 相手ターン中+opp Lv8登場→optional[draw1→discard1] / a2 ヒラメキ remove高校生→hand', () => {
    const a1 = ab(B07024, 'a1');
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    expect(a1.trigger.matcherCondition).toMatchObject({ kind: 'triggerCharMatches', side: 'opp', payloadKey: 'uid', filter: { kind: 'character', levelMin: 8, levelMax: 8 } });
    // 「引いてもよい。そうした場合リムーブ」= optional{ chain[draw, discard] } (B07024 idiom)
    expect((a1.effect as Record<string, unknown>).kind).toBe('optional');
    expect(findArgs(a1.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
    expect(findArgs(a1.effect, 'discard')).toMatchObject({ player: 'self', n: 1 });
    const a2 = ab(B07024, 'a2');
    expect(findArgs(a2.effect, 'handAddFromRemove')).toMatchObject({ player: 'self', max: 1, filter: { kind: 'character', trait: '高校生' } });
  });

  it('B02073 上原由衣: a1 宣言 cost[sleepSelf+removeSelf]→長野県警1枚まで迅速付与(turn) / a2 ヒラメキ draw1', () => {
    const a1 = ab(B02073, 'a1');
    expect(a1.type).toBe('declared');
    // コスト「【スリープ】〚リムーブエリアに移す〛」= sleepSelf + 自身を現場から除去
    const cost = a1.cost as Record<string, unknown>;
    expect(cost.kind).toBe('pay');
    const items = cost.items as Array<Record<string, unknown>>;
    expect(items.some((i) => i.kind === 'sleepSelf')).toBe(true);
    expect(items.some((i) => i.kind === 'removeFromScene' && (i.target as Record<string, unknown>)?.kind === 'self')).toBe(true);
    // 効果「長野県警を1枚まで選び、ターン終了時まで迅速付与」
    const g = findArgs(a1.effect, 'charGrantKeyword')!;
    expect(g).toMatchObject({ uid: '$pick', kw: '迅速', scope: 'turn' });
    expect((g.target as Record<string, unknown>)).toMatchObject({ kind: 'pick', n: { min: 0, max: 1 }, chooser: 'self' });
    expect(((g.target as Record<string, unknown>).query as Record<string, unknown>)).toMatchObject({ side: 'either', filter: { trait: '長野県警' } });
    expect(findArgs(ab(B02073, 'a2').effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
  });

  it('D02005 遠山和葉: a1 enter(このキャラ/服部平次)+ターン1→sleep短縮形 / a2 ヒラメキ sleep は uid:$pick explicit form (BUG-140)', () => {
    const a1 = ab(D02005, 'a1');
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a1.trigger.matcherCondition).toMatchObject({ kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { cardName: ['遠山和葉', '服部平次'] } });
    // a1 effect「キャラを1枚まで選びスリープ」= 短縮形 (uid 無し / side:either / max:1)。「キャラ」=両側(rules/15)。
    const e1 = findArgs(a1.effect, 'sceneSetState')!;
    expect(e1).toMatchObject({ player: 'self', max: 1, side: 'either', state: 'sleep' });
    expect(e1.uid).toBeUndefined(); // 短縮形 (enter-triggered は runtime paShortFormAwait で pick surface)
    // a2 ヒラメキ「キャラを1枚まで選びスリープ」= explicit uid:$pick + target (hirameki fire 必須形, BUG-140)
    const e2 = findArgs(ab(D02005, 'a2').effect, 'sceneSetState')!;
    expect(e2.uid).toBe('$pick');
    expect(e2.state).toBe('sleep');
    expect((e2.target as Record<string, unknown>)).toMatchObject({ kind: 'pick', n: { min: 0, max: 1 }, chooser: 'self' });
  });

  it('PR036 遠山和葉: D02005 と byte-identical (clone, a1 短縮形 / a2 uid:$pick)', () => {
    expect(JSON.stringify(PR036.abilities)).toBe(JSON.stringify(D02005.abilities));
    expect(PR036.id).toBe('PR036');
    expect(PR036.level).toBe(D02005.level);
    expect(PR036.ap).toBe(D02005.ap);
  });
});

// ───────────────────────── B. end-to-end trigger gating (B02008 enter) ─────────────────────────
describe('wave novel-tail-0627 — B02008 enter trigger gating (decoy 1対1)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _resetRegistry();
    registerAll();
    registerCardDef(defOf({ id: 'SBD', names: ['少年探偵A'], traits: ['少年探偵団'], level: 4 })); // 少年探偵団 (match)
    registerCardDef(defOf({ id: 'DECOY', names: ['通行人'], traits: ['一般人'], level: 4 })); // 非少年探偵団 (decoy)
    registerTriggeredListener();
  });

  function fired(after: GameState, bearerUid: string): boolean {
    return after.pendingEffects.some((pe) => pe.triggeredBy?.hook === 'enter' && pe.source?.uid === bearerUid);
  }

  // bearer B02008 を self 現場に置いた state を作る。
  function withBearer(): { s: GameState; bearerUid: string } {
    let bearerUid = '';
    const s = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      const k = mutate.scene.enter(d, 'self', 'B02008', {});
      bearerUid = k.uid;
    });
    return { s, bearerUid };
  }
  // side に cardId を登場させ、enter hook を emit する (mutate.scene.enter は配置のみ・hook 非emit)。
  function enterAndEmit(s: GameState, side: 'self' | 'opp', cardId: string): GameState {
    return produce(s, (d) => {
      const k = mutate.scene.enter(d, side, cardId, side === 'opp' ? { named: false } : {});
      event.emit(d, 'enter', { uid: k.uid, viaEffect: false, enterOrder: 1 }, { uid: k.uid, cardId, player: side });
    });
  }

  it('自分の現場に〚特徴[少年探偵団]〛が登場 → B02008 a1 発火', () => {
    const { s, bearerUid } = withBearer();
    const after = enterAndEmit(s, 'self', 'SBD');
    expect(fired(after, bearerUid)).toBe(true);
  });

  it('自分の現場に 非[少年探偵団] が登場 → 非発火 (decoy: trait filter)', () => {
    const { s, bearerUid } = withBearer();
    const after = enterAndEmit(s, 'self', 'DECOY');
    expect(fired(after, bearerUid)).toBe(false);
  });

  it('相手の現場に〚特徴[少年探偵団]〛が登場 → 非発火 (decoy: side:self gate)', () => {
    const { s, bearerUid } = withBearer();
    const after = enterAndEmit(s, 'opp', 'SBD');
    expect(fired(after, bearerUid)).toBe(false);
  });

  it('【ターン①】は自分ターンで発動後も、直後の相手ターンに再び発動できる', () => {
    const { s, bearerUid } = withBearer();
    let after = enterAndEmit(s, 'self', 'SBD');
    expect(fired(after, bearerUid)).toBe(true);

    after = produce(after, (d) => {
      // この検証は発動回数のターン境界だけを対象とするため、1回目の効果を解決済みにする。
      d.pendingEffects = [];
      endTurn(d, 'self', { startNextTurn: true });
    });
    expect(after.turn.player).toBe('opp');

    const nextTurn = enterAndEmit(after, 'self', 'SBD');
    expect(fired(nextTurn, bearerUid)).toBe(true);
  });
});
