// wave engine-unlocked-0624 (engine変更0) — engine additive wave a206e9dc 解放 DEFER の card 出荷。
//   B08023/P 大岡紅葉 = 【登場時】choice×3 carrier-reuse (伊織無我 setCard+AP/突撃 / 相手 setCard+sleep)。
//   B08050/P 宮野明美 = 【解決編】lvlDelta+3 (continuous) + 【登場時】deck-look3 (handAdd→boundToRemove→cardNameNot discard)。
// DEFER 据置: B08004/P (リムーブ黒キャラ count gate = remove color+kind 未対応) / B08059/P (self-count latch)。
//
// ⚠ 敵対 review BLOCKER 2件を反映:
//   (1) B08023 carrier-reuse は **短縮形必須** (BUG-158): 明示 uid:'$pick'+target 形は human 経路で
//       bind 喪失 → rider silent no-op。本 test は **human 経路** で rider 発火を pin する (回帰防止)。
//   (2) B08050 a2 は handAdd→boundToRemove→discard 順 (deck≤3 で boundToRemove のリフレッシュが
//       discard 札を巻き戻す逆順 bug を防ぐ)。本 test は deck=3 で discard 札が remove に残ることを pin。
// rules: 11-reasoning.md, 14-refresh.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md,
//        19-special-rules.md, 24-qa-naming-stun.md, 26-qa-deck-refresh.md
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import {
  resolveEffectPicks,
  _drainPendingEffectChoiceSide,
  _drainPendingEffectPickSide,
  _peekPendingEffectPickQueueLength,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import { applyChoiceAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { read } from '@/engine/read/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll, REUSE_CARDS } from '@/cards/index';
import { sceneChar } from '../helpers/fixtures';
import { B08023 } from '@/cards/ct-p08/B08023';
import { B08023P } from '@/cards/ct-p08/B08023P';
import { B08050 } from '@/cards/ct-p08/B08050';
import { B08050P } from '@/cards/ct-p08/B08050P';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const FB = 'D08017'; // card-back filler (registered)
const IORI = ch('IORI', { names: ['伊織無我'] });
const ENEMY = ch('ENEMY', { names: ['敵キャラ'], colors: ['青'] });
const SETSRC = ch('SETSRC', { names: ['setsrc'] });
const MOROBOSHI = ch('MOROBOSHI', { names: ['諸星大'] });
const NONSET = ch('NONSET', { names: ['その他'] });
const R1 = ch('RR1', { names: ['rest1'] });
const R2 = ch('RR2', { names: ['rest2'] });

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  [IORI, ENEMY, SETSRC, MOROBOSHI, NONSET, R1, R2].forEach(registerCardDef);
  registerTriggeredListener();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self'; // HUMAN path (回帰の本丸)
});

function baseTurn(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}
const ctx = (): EffectCtx => ({ source: { player: 'self', area: 'scene', cardId: 'B08023', uid: 'actor#1' }, bindings: {} } as EffectCtx);

// B08023【登場時】を human 経路で駆動: choice option を選択 → 後続 pick を pickUid で解決。
function runB08023Human(s: GameState, optIdx: number, pickUid: string | null): void {
  const walked = resolveEffectPicks(s, B08023.abilities[0].effect!, ctx(), { humanChooser: true, byPlayer: 'self', source: { cardId: 'B08023', abilityId: 'a1' } });
  runEffect(s, walked as never, ctx());
  runAllUntilEmpty(s);
  const cside = _drainPendingEffectChoiceSide();
  if (!cside) throw new Error('choice not surfaced');
  applyChoiceAndContinuation(s, cside, optIdx);
  let guard = 0;
  while (_peekPendingEffectPickQueueLength() > 0 && guard++ < 4) {
    const p = _drainPendingEffectPickSide()!;
    const cands = (p as { candidates?: Array<{ uid: string }> }).candidates ?? [];
    const uid = pickUid ?? cands[0]?.uid ?? '';
    applyPickAndContinuation(s, p, uid, uid ? [uid] : []);
  }
}
const OPTS = (B08023.abilities[0].effect as { options: unknown[] }).options;

// ---------------- structural ----------------
describe('wave engine-unlocked-0624 — structural', () => {
  it('4 枚が REUSE_CARDS に登録', () => {
    const ids = new Set(REUSE_CARDS.map((c) => c.id));
    ['B08023', 'B08023P', 'B08050', 'B08050P'].forEach((id) => expect(ids.has(id), `${id} 登録`).toBe(true));
  });
  it('B08023 = 【登場時】choice×3 / 各 option は短縮形 carrier (bind $picked, uid:$pick 不使用=BUG-158 回避)', () => {
    const a1 = B08023.abilities[0];
    expect(a1.type).toBe('triggered');
    expect((a1.trigger as { hook: string; selfOnly?: boolean }).hook).toBe('enter');
    expect((a1.trigger as { selfOnly?: boolean }).selfOnly).toBe(true);
    expect(OPTS.length).toBe(3);
    (OPTS as Array<{ steps: Array<{ args?: { bind?: string; uid?: string; max?: number } }> }>).forEach((o) => {
      const setStep = o.steps[0];
      expect(setStep.args?.bind, 'carrier bind').toBe('$picked');
      expect(setStep.args?.uid, '短縮形 = uid:$pick 不使用 (human bind 喪失回避)').toBeUndefined();
      expect(setStep.args?.max, '1枚まで=max1').toBe(1);
    });
  });
  it('B08050 = a1 continuous lvlDelta+3 / a2 triggered enter deck-look (handAdd→boundToRemove→discard 順)', () => {
    const [a1, a2] = B08050.abilities;
    expect(a1.type).toBe('continuous');
    expect((a1 as { continuousModifier?: { lvlDelta?: number } }).continuousModifier?.lvlDelta).toBe(3);
    expect((a1.condition as { kind: string; status?: string }).status).toBe('解決編');
    const steps = (a2.effect as { steps: Array<{ verb?: string; if?: { kind?: string; filter?: { cardNameNot?: string[] } } }> }).steps;
    expect(steps[0].verb).toBe('deckRevealUntil');
    const boundIdx = steps.findIndex((x) => x.verb === 'boundToRemove');
    const discIdx = steps.findIndex((x) => x.if?.kind === 'boundMatchesFilter');
    expect(boundIdx, 'boundToRemove 存在').toBeGreaterThanOrEqual(0);
    expect(discIdx, 'discard conditional 存在').toBeGreaterThanOrEqual(0);
    expect(boundIdx, 'boundToRemove は discard より前 (deck≤3 巻き戻し防止)').toBeLessThan(discIdx);
    const disc = steps[discIdx];
    expect(disc.if?.filter?.cardNameNot).toEqual(['諸星大', '宮野志保', '宮野エレーナ', '宮野厚司']);
  });
  it('parallel = テキスト同一 (abilities 参照共有)', () => {
    expect(B08023P.abilities).toBe(B08023.abilities);
    expect(B08050P.abilities).toBe(B08050.abilities);
  });
});

// ---------------- B08023 behavioral (HUMAN 経路 = BUG-158 回帰防止) ----------------
describe('B08023 carrier-reuse (HUMAN path)', () => {
  it('opt1: 伊織無我に self-deck setCard + ターン終了時まで AP+2000', () => {
    const s = baseTurn();
    s.players.self.scene = [sceneChar('B08023', 'actor#1'), sceneChar('IORI', 'iori#1')];
    s.players.self.deck = ['SETSRC', FB, FB];
    runB08023Human(s, 0, 'iori#1');
    expect(read.char.setCards(s, 'iori#1').length, '伊織無我に1枚 set').toBe(1);
    expect(read.char.ap(s, 'iori#1'), 'AP 3000+2000 (human rider 発火)').toBe(5000);
    expect(s.players.self.deck, 'setCard 用にデッキ top 消費').not.toContain('SETSRC');
  });
  it('opt2: 伊織無我に setCard + 突撃 付与 (human rider)', () => {
    const s = baseTurn();
    s.players.self.scene = [sceneChar('B08023', 'actor#1'), sceneChar('IORI', 'iori#1')];
    s.players.self.deck = ['SETSRC', FB, FB];
    runB08023Human(s, 1, 'iori#1');
    expect(read.char.setCards(s, 'iori#1').length).toBe(1);
    expect(read.char.keywords(s, 'iori#1'), '突撃 付与').toContain('突撃');
  });
  it('opt3: 相手キャラに opp-deck setCard + スリープ (human rider)', () => {
    const s = baseTurn();
    s.players.self.scene = [sceneChar('B08023', 'actor#1')];
    s.players.opp.scene = [sceneChar('ENEMY', 'foe#1')];
    s.players.opp.deck = ['SETSRC', FB, FB];
    runB08023Human(s, 2, 'foe#1');
    expect(read.char.setCards(s, 'foe#1').length, '相手キャラに1枚 set').toBe(1);
    expect(read.char.state(s, 'foe#1'), 'スリープ化 (human rider)').toBe('sleep');
    expect(s.players.opp.deck, '相手デッキ top 消費').not.toContain('SETSRC');
  });
  it('opt3: スタン状態の相手キャラに「スリープさせる」→ スタンのまま (rules/24)', () => {
    const s = baseTurn();
    s.players.self.scene = [sceneChar('B08023', 'actor#1')];
    const foe = sceneChar('ENEMY', 'foe#1');
    foe.state = 'stun';
    s.players.opp.scene = [foe];
    s.players.opp.deck = ['SETSRC', FB, FB];
    runB08023Human(s, 2, 'foe#1');
    expect(read.char.setCards(s, 'foe#1').length).toBe(1);
    expect(read.char.state(s, 'foe#1'), 'スタンは維持').toBe('stun');
  });
  it('opt1 で伊織無我が現場に居ない → 0枚 pick (まで=0) → no-op', () => {
    const s = baseTurn();
    s.players.self.scene = [sceneChar('B08023', 'actor#1')];
    s.players.self.deck = ['SETSRC', FB, FB];
    runB08023Human(s, 0, null);
    expect(s.players.self.deck, 'setCard 不発でデッキ不変').toContain('SETSRC');
  });
});

// ---------------- B08050 behavioral ----------------
describe('B08050 lvlDelta + deck-look', () => {
  it('a1: 解決編で level 4→7 / 事件編は 4 (現場 continuous)', () => {
    const s = baseTurn();
    s.players.self.scene = [sceneChar('B08050', 'm#1')];
    s.players.self.case.status = '事件編';
    expect(read.char.level(s, 'm#1'), '事件編=base4').toBe(4);
    s.players.self.case.status = '解決編';
    expect(read.char.level(s, 'm#1'), '解決編=4+3').toBe(7);
  });

  // B08050【登場時】を human 経路で駆動 (deck-look pick = top を取得、discard pick も解決)。
  function playB08050(deck: string[]): GameState {
    let s = baseTurn();
    s.players.self.hand = ['B08050'];
    s.players.self.case.colors = ['赤'];
    s.players.self.case.status = '事件編';
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.deck = [...deck];
    s = produce(s, (d) => { handUseCard(d, 'self', 'B08050'); runAllUntilEmpty(d); });
    let guard = 0;
    while ((_peekPendingEffectPickQueueLength() ?? 0) > 0 && guard++ < 6) {
      s = produce(s, (d) => {
        const p = _drainPendingEffectPickSide()!;
        const cands = (p as { candidates?: Array<{ uid: string }> }).candidates ?? [];
        const uid = cands[0]?.uid ?? deck[0];
        applyPickAndContinuation(d, p, uid, [uid]);
      });
    }
    return s;
  }

  it('登場(padded): in-set 諸星大 を手札 / 残り2枚はリムーブ', () => {
    const s = playB08050(['MOROBOSHI', FB, FB, FB, FB, FB, FB]);
    expect(s.players.self.scene.find((c) => c.cardId === 'B08050'), '登場').toBeTruthy();
    expect(s.players.self.hand, 'top(諸星大) を手札 (in-set→discard なし)').toContain('MOROBOSHI');
    expect(s.players.self.remove.length, '残り2枚 (公開窓) はリムーブ').toBeGreaterThanOrEqual(2);
  });
  it('登場(padded): not-in-set その他 → discard で net0', () => {
    const s = playB08050(['NONSET', FB, FB, FB, FB, FB, FB]);
    expect(s.players.self.hand.length, 'add1 - discard1 = net0').toBe(0);
  });

  // ⚠ BLOCKER 回帰: deck ちょうど3枚 → boundToRemove で deck0 リフレッシュ。順序が正しければ
  //   discard 札 (NONSET) は remove に残る。逆順だと refresh が NONSET を deck へ巻き戻す。
  it('deck=3 枯渇: 順序が正 → discard 札(NONSET)は remove に残り deck へ戻らない', () => {
    const s = playB08050(['NONSET', 'RR1', 'RR2']);
    expect(s.players.self.hand.length, 'NONSET 加→discard で net0').toBe(0);
    expect(s.players.self.deck, 'discard 済 NONSET は deck へ巻き戻らない').not.toContain('NONSET');
    expect(s.players.self.remove, 'discard 済 NONSET は remove に残る').toContain('NONSET');
  });
});
