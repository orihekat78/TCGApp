// tests/cards/miniwave5/manual-probes — deck-reveal 拡張 (mini-wave #5) consumer 実カード probe
//   B03049 黒羽盗一 (宣言 cost self→remove: デッキ下1枚公開 → 白 lv≤FILE なら登場 / それ以外 手札) /
//   B05047 怪盗キッド (【登場時】【変装時】上2枚見て各カードを上か下へ — a2 disguise:into 側)。
//   production 経路: activateDeclaredAbility + runAllUntilEmpty (宣言、BUG-171) +
//   event.emit('disguise:into', production payload) (変装時)。engine / src/cards は変更しない (probe のみ)。
// rules: 21 (コスト self 省略) / 26 (見ている間はデッキ扱い) / 15 (「する」= 必須) / QA (必ず登場)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _drainPendingDeckPlaceSide } from '@/engine/effect/atom-handlers/_shared';
import { B03049 } from '@/cards/ct-p03/B03049';
import { B03049P } from '@/cards/ct-p03/B03049P';
import { B05047 } from '@/cards/ct-p05/B05047';
import type { CardDef, GameState } from '@/engine/types';

function charDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
const WH3 = charDef('WH3', { colors: ['白'], level: 3 });
const WH9 = charDef('WH9', { colors: ['白'], level: 9 });
const REDEV: CardDef = { id: 'REDEV', no: 'REDEV', kind: 'event', names: ['赤イベ'], colors: ['赤'], level: 2, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
const FILLER = charDef('FILLER');
const FIXTURES = [WH3, WH9, REDEV, FILLER, B03049, B03049P, B05047];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}
function fileBack(n: number): { type: 'card-back'; cardId: string }[] {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: 'FILLER' }));
}
function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} } as never;
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['白'], declaredUseCount: {} } as never;
  return s;
}

beforeEach(() => {
  event._resetRegistry(); // handler 累積防止 (miniwave3/4 manual-probes 慣行)
  resetDefRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  for (const d of FIXTURES) { registerCardDef(d); }
  registerTriggeredListener();
  setHuman(null); // AI 経路既定 (deckPlace は恒等)。human 検証は個別 test で切替
  (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
});

describe('B03049 a1 — デッキ下1枚公開 → 白 lv≤FILE 登場 / それ以外 手札 (fromBottom)', () => {
  function declare(s: GameState): void {
    const c = mutate.scene.enter(s, 'self', 'B03049', {});
    (s.players.self.scene.find(x => x.uid === c.uid) as { state: string }).state = 'active';
    activateDeclaredAbility(s, c.uid, 'a1');
    runAllUntilEmpty(s);
  }
  it('match 枝: 底が白 lv3・FILE4 → 登場 (必ず、QA)。cost で自身は remove へ', () => {
    const s = base();
    s.players.self.file = fileBack(4) as never;
    s.players.self.deck = ['FILLER', 'REDEV', 'WH3']; // 底 = WH3 (白 lv3 ≤ FILE4)
    declare(s);
    expect(s.players.self.remove).toContain('B03049'); // cost: リムーブエリアに移す (rules/21 対象省略 = 自身)
    expect(s.players.self.scene.some(c => c.cardId === 'WH3'), '底の白キャラが登場').toBe(true);
    expect(s.players.self.hand, '手札には加えない').toEqual([]);
    expect(s.players.self.deck, 'デッキから WH3 が出た').toEqual(['FILLER', 'REDEV']);
  });
  it('else 枝: 底が赤イベント → 手札に加える。登場しない', () => {
    const s = base();
    s.players.self.file = fileBack(4) as never;
    s.players.self.deck = ['FILLER', 'WH3', 'REDEV']; // 底 = REDEV (キャラでない)
    declare(s);
    expect(s.players.self.hand, '底カードを手札へ').toEqual(['REDEV']);
    expect(s.players.self.scene.some(c => c.cardId === 'REDEV')).toBe(false);
    expect(s.players.self.deck).toEqual(['FILLER', 'WH3']);
  });
  it('else 枝 (レベル超過): 底が白 lv9・FILE4 → filter 不一致で手札へ (levelMax dyn $self.fileCount)', () => {
    const s = base();
    s.players.self.file = fileBack(4) as never;
    s.players.self.deck = ['FILLER', 'WH9'];
    declare(s);
    expect(s.players.self.hand).toEqual(['WH9']);
    expect(s.players.self.scene.some(c => c.cardId === 'WH9')).toBe(false);
  });
  it('review B1 match 枝: 同名コピーがデッキ上方にあっても底の 1 枚が抜かれる (deckPos bottom)', () => {
    const s = base();
    s.players.self.file = fileBack(4) as never;
    s.players.self.deck = ['WH3', 'FILLER', 'WH3']; // top と底に同名 — 公開したのは底
    declare(s);
    expect(s.players.self.scene.some(c => c.cardId === 'WH3')).toBe(true);
    expect(s.players.self.deck, 'top 側コピーは残る (隠れ順序不変)').toEqual(['WH3', 'FILLER']);
  });
  it('review B1 else 枝: 同名コピーがあっても底の 1 枚が手札へ (positional handAddFromDeckBottom)', () => {
    const s = base();
    s.players.self.file = fileBack(4) as never;
    s.players.self.deck = ['REDEV', 'FILLER', 'REDEV'];
    declare(s);
    expect(s.players.self.hand).toEqual(['REDEV']);
    expect(s.players.self.deck, 'top 側コピーは残る').toEqual(['REDEV', 'FILLER']);
  });
  it('review/QA: デッキ残1枚 (底のみ) → 手札に加えた時点で即リフレッシュ (rules/14+26、相手が証拠1)', () => {
    const s = base();
    s.players.self.file = fileBack(4) as never;
    s.players.self.deck = ['REDEV'];
    s.players.self.remove = ['FILLER', 'FILLER'];
    declare(s); // cost で B03049 も remove へ → refresh 時 shuffle 対象 3 枚
    expect(s.players.self.hand).toEqual(['REDEV']);
    expect(s.players.self.deck.length, 'リムーブ 3 枚がデッキに戻る').toBe(3);
    expect(s.players.self.remove).toEqual([]);
    expect(s.players.opp.evidence.length, '相手が証拠 1 (rules/14 手順2)').toBe(1);
  });
  it('P variant: B03049P は base と同一 abilities (slim clone 参照同一)', () => {
    expect(B03049P.abilities).toBe(B03049.abilities);
    expect(B03049P.id).toBe('B03049P');
  });
});

describe('B05047 a2 — 【変装時】上2枚見て各カードを上か下へ (disguise:into 側)', () => {
  function fireDisguise(s: GameState): void {
    const c = mutate.scene.enter(s, 'self', 'B05047', {});
    // production payload 形 = flow/contact.ts:264 (uid/fromCardId/newCardId/player/replacedChar + source)
    event.emit(
      s,
      'disguise:into',
      { uid: c.uid, fromCardId: 'FILLER', newCardId: 'B05047', player: 'self', replacedChar: { cardId: 'FILLER' } },
      { player: 'self', uid: c.uid, bindings: {} },
    );
    runAllUntilEmpty(s);
  }
  it('AI (human 無し): 恒等 — deck 不変で完走 (smoke 安全)', () => {
    const s = base();
    s.players.self.deck = ['REDEV', 'WH3', 'FILLER'];
    fireDisguise(s);
    expect(s.players.self.deck, 'AI 既定 = 元順 top (恒等)').toEqual(['REDEV', 'WH3', 'FILLER']);
    expect(_drainPendingDeckPlaceSide()).toBeNull();
    expect(s.log.some(l => l.action === 'effect:deckPlaceSplitBound'), 'atom は実行された').toBe(true);
  });
  it('human self: 上2枚が pending に乗り await (deck 未移動 rules/26)', () => {
    setHuman('self');
    const s = base();
    s.players.self.deck = ['REDEV', 'WH3', 'FILLER'];
    fireDisguise(s);
    const pending = _drainPendingDeckPlaceSide();
    expect(pending).not.toBeNull();
    expect(pending!.cardIds, '上から 2 枚 (公開順)').toEqual(['REDEV', 'WH3']);
    expect(s.players.self.deck, 'await 中は未移動').toEqual(['REDEV', 'WH3', 'FILLER']);
  });
  it('デッキ残 1 枚: 見られる分のみ (rules/26、リフレッシュしない)', () => {
    setHuman('self');
    const s = base();
    s.players.self.deck = ['WH3'];
    s.players.self.remove = ['FILLER']; // refresh 敗北防御 (発生しない想定だが敗北判定に入らないこと自体を確認)
    fireDisguise(s);
    const pending = _drainPendingDeckPlaceSide();
    expect(pending!.cardIds).toEqual(['WH3']);
    expect(s.players.self.deck).toEqual(['WH3']);
  });
});
