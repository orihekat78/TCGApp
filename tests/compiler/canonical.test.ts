// Track B compiler — canonical 正規化の単体テスト。
import { describe, it, expect } from 'vitest';
const { canonicalize, canonicalCard, stableStringify, hasClosure } = require('../../scripts/compiler/canonical.cjs');

describe('compiler/canonical', () => {
  it('key 順の違いを吸収する', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('undefined フィールドを除去する', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });

  it('配列の順序は保持する (abilities の a1/a2 順は意味を持つ)', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('関数は <closure> marker になり hasClosure が検出する', () => {
    const withFn = { effect: { run: () => 0 } };
    expect(canonicalize(withFn).effect.run).toBe('<closure>');
    expect(hasClosure(withFn)).toBe(true);
    expect(hasClosure({ effect: { kind: 'atom' } })).toBe(false);
  });

  it('canonicalCard は abilities+keywords のみ比較対象にし keywords 順序を吸収する', () => {
    const a = canonicalCard({ id: 'X1', ap: 3000, keywords: ['突撃', '迅速'], abilities: [{ type: 'triggered' }] });
    const b = canonicalCard({ id: 'X1', lp: 2, keywords: ['迅速', '突撃'], abilities: [{ type: 'triggered' }] });
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('keywords / abilities 欠落は空配列に正規化される', () => {
    const c = canonicalCard({ id: 'X2' });
    expect(c.keywords).toEqual([]);
    expect(c.abilities).toEqual([]);
  });

  it('semanticCard: id/name/description/ruleRefs は非意味 metadata として比較から落ちる (a1/a2 揺れ吸収)', () => {
    const { semanticCard } = require('../../scripts/compiler/canonical.cjs');
    const a = semanticCard({ abilities: [{ id: 'a1', name: 'N', description: 'D。', ruleRefs: ['rules/x'], type: 'triggered', scope: 'on-scene' }] });
    const b = semanticCard({ abilities: [{ id: 'a2', description: 'D', type: 'triggered', scope: 'on-scene' }] });
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('semanticCard: type/scope/trigger/condition/effect の差は意味差として保持される', () => {
    const { semanticCard } = require('../../scripts/compiler/canonical.cjs');
    const a = semanticCard({ abilities: [{ id: 'a1', type: 'triggered' }] });
    const b = semanticCard({ abilities: [{ id: 'a1', type: 'continuous' }] });
    expect(stableStringify(a)).not.toBe(stableStringify(b));
  });
});

// B3-1 (2026-07-02): engine 実測で結果同値と証明された encoding 揺れの射影正規化。
// 各規則の根拠脚注は canonical.cjs 冒頭コメント参照。
describe('compiler/canonical 意味等価正規化 (B3-1)', () => {
  const { semanticAbility } = require('../../scripts/compiler/canonical.cjs');
  const sleepAtom = {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      state: 'sleep',
      uid: '$pick',
      target: { chooser: 'self', kind: 'pick', n: { max: 1, min: 0 }, query: { area: 'scene', side: 'either' } },
    },
  };
  const hiramekiTrig = { hook: 'evidence:remove-by-action', optional: true };

  it('N1: singleton choice は bare atom と同一射影 (C1/C5: B01089 型 ≡ B01048 型)', () => {
    const bare = semanticAbility({ type: 'triggered', scope: 'on-evidence', trigger: hiramekiTrig, effect: sleepAtom });
    const wrapped = semanticAbility({
      type: 'triggered', scope: 'on-evidence', trigger: hiramekiTrig,
      effect: { kind: 'choice', chooser: 'self', options: [sleepAtom] },
    });
    expect(stableStringify(bare)).toBe(stableStringify(wrapped));
  });

  it('N1 negative: 複数 option choice は unwrap されない (modal が出る real 差)', () => {
    const two = semanticAbility({
      type: 'triggered', trigger: hiramekiTrig,
      effect: { kind: 'choice', chooser: 'self', options: [sleepAtom, { kind: 'atom', verb: 'draw', args: { n: 1, player: 'self' } }] },
    });
    const one = semanticAbility({ type: 'triggered', trigger: hiramekiTrig, effect: sleepAtom });
    expect(stableStringify(two)).not.toBe(stableStringify(one));
  });

  it('N2: matcherCondition(removedCharMatches) は condition と同一射影 (C4: B07097 型 ≡ B01007 型)', () => {
    const cond = { by: 'self', cause: 'contact-ap', kind: 'removedCharMatches', side: 'opp' };
    const draw = { kind: 'atom', verb: 'draw', args: { n: 1, player: 'self' } };
    const viaCondition = semanticAbility({
      type: 'triggered', scope: 'on-scene', condition: cond, trigger: { hook: 'leave:to-remove' }, effect: draw,
    });
    const viaMatcher = semanticAbility({
      type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', matcherCondition: cond }, effect: draw,
    });
    expect(stableStringify(viaCondition)).toBe(stableStringify(viaMatcher));
  });

  it('N2 negative: enterOrderEquals (疾風分類が存在自体を読む) は lift されない', () => {
    const mc = { kind: 'enterOrderEquals', n: 2 };
    const draw = { kind: 'atom', verb: 'draw', args: { n: 1, player: 'self' } };
    const viaMatcher = semanticAbility({
      type: 'triggered', trigger: { hook: 'enter', selfOnly: true, matcherCondition: mc }, effect: draw,
    });
    const viaCondition = semanticAbility({
      type: 'triggered', condition: mc, trigger: { hook: 'enter', selfOnly: true }, effect: draw,
    });
    expect(stableStringify(viaMatcher)).not.toBe(stableStringify(viaCondition));
  });

  it('N2 negative: ability.condition 既存時は merge しない', () => {
    const mc = { by: 'self', cause: 'contact-ap', kind: 'removedCharMatches', side: 'opp' };
    const draw = { kind: 'atom', verb: 'draw', args: { n: 1, player: 'self' } };
    const both = semanticAbility({
      type: 'triggered', condition: { kind: 'turn', player: 'self' },
      trigger: { hook: 'leave:to-remove', matcherCondition: mc }, effect: draw,
    });
    expect(stableStringify(both)).toContain('matcherCondition');
  });

  it('N3: charSetCard faceUp:false は省略形と同一射影 (C3: B05030 型 ≡ B07048 型)', () => {
    const trig = { hook: 'enter', selfOnly: true };
    const withFalse = semanticAbility({
      type: 'triggered', scope: 'on-scene', trigger: trig,
      effect: { kind: 'atom', verb: 'charSetCard', args: { faceUp: false, fromDeckTop: true, player: 'self', uid: '$self' } },
    });
    const omitted = semanticAbility({
      type: 'triggered', scope: 'on-scene', trigger: trig,
      effect: { kind: 'atom', verb: 'charSetCard', args: { fromDeckTop: true, player: 'self', uid: '$self' } },
    });
    expect(stableStringify(withFalse)).toBe(stableStringify(omitted));
  });

  it('N3 negative: faceUp:true は落とさない (表向きセットは意味差)', () => {
    const eff = semanticAbility({
      type: 'triggered', trigger: { hook: 'enter' },
      effect: { kind: 'atom', verb: 'charSetCard', args: { faceUp: true, fromDeckTop: true, player: 'self', uid: '$self' } },
    });
    expect(stableStringify(eff)).toContain('faceUp');
  });

  it('N4: sceneSetState 短縮形は effect-root で明示 pick 形と同一射影 (C1: B06029 型 ≡ B01048 型)', () => {
    const short = semanticAbility({
      type: 'triggered', scope: 'on-evidence', trigger: hiramekiTrig,
      effect: { kind: 'atom', verb: 'sceneSetState', args: { max: 1, player: 'self', side: 'either', state: 'sleep' } },
    });
    const explicit = semanticAbility({ type: 'triggered', scope: 'on-evidence', trigger: hiramekiTrig, effect: sleepAtom });
    expect(stableStringify(short)).toBe(stableStringify(explicit));
  });

  it('N4: singleton choice 越しの短縮形も root 扱いで展開される (N1 が root 性を透過)', () => {
    const short = semanticAbility({
      type: 'triggered', trigger: hiramekiTrig,
      effect: {
        kind: 'choice', chooser: 'self',
        options: [{ kind: 'atom', verb: 'sceneSetState', args: { max: 1, player: 'self', side: 'either', state: 'sleep' } }],
      },
    });
    const explicit = semanticAbility({ type: 'triggered', trigger: hiramekiTrig, effect: sleepAtom });
    expect(stableStringify(short)).toBe(stableStringify(explicit));
  });

  it('N4 negative: sequence 途中の短縮形は展開しない (dispatch 時 surface と walk 時 surface は前段 mutation 越しに非同値)', () => {
    const shortArgs = { max: 1, player: 'self', side: 'either', state: 'sleep' };
    const inSeq = semanticAbility({
      type: 'triggered', trigger: hiramekiTrig,
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'draw', args: { n: 1, player: 'self' } },
          { kind: 'atom', verb: 'sceneSetState', args: shortArgs },
        ],
      },
    });
    expect(stableStringify(inSeq)).toContain('"max":1,"player":"self"');
  });

  it('N4 negative: player:opp の短縮形は展開しない (pick 実行者 byPlayer が明示形 owner と相違 — T2 semantic lens)', () => {
    const opp = semanticAbility({
      type: 'triggered', trigger: hiramekiTrig,
      effect: { kind: 'atom', verb: 'sceneSetState', args: { max: 1, player: 'opp', side: 'either', state: 'sleep' } },
    });
    expect(stableStringify(opp)).toContain('"player":"opp"');
  });

  it('N4 negative: 未知 arg 付き短縮形は展開しない (engine mirror 不能形は conflict として顕在化)', () => {
    const weird = semanticAbility({
      type: 'triggered', trigger: hiramekiTrig,
      effect: { kind: 'atom', verb: 'sceneSetState', args: { max: 1, player: 'self', state: 'sleep', distinctNames: true } },
    });
    expect(stableStringify(weird)).toContain('distinctNames');
  });

  it('N5: icon-disguise の配列位置は非意味 (先頭でも末尾でも同一射影)', () => {
    const { semanticCard } = require('../../scripts/compiler/canonical.cjs');
    const disguiseAb = { type: 'icon-disguise', condition: { kind: 'fileAtLeast', n: 6 } };
    const hiramekiAb = { type: 'triggered', scope: 'on-evidence', trigger: hiramekiTrig, effect: sleepAtom };
    const first = semanticCard({ abilities: [disguiseAb, hiramekiAb] });
    const last = semanticCard({ abilities: [hiramekiAb, disguiseAb] });
    expect(stableStringify(first)).toBe(stableStringify(last));
  });

  it('N5 negative: 非 disguise 同士の順序は意味差として保持される', () => {
    const { semanticCard } = require('../../scripts/compiler/canonical.cjs');
    const a = { type: 'triggered', trigger: { hook: 'enter' }, effect: { kind: 'atom', verb: 'draw', args: { n: 1, player: 'self' } } };
    const b = { type: 'continuous', scope: 'on-scene', continuousModifier: { apDelta: 1000 } };
    expect(stableStringify(semanticCard({ abilities: [a, b] })))
      .not.toBe(stableStringify(semanticCard({ abilities: [b, a] })));
  });

  it('N1/N3 は chain 内にも届く (T2 edge-test lens: B09038 は chain 内 charSetCard faceUp:false を実在させる)', () => {
    const inner = { kind: 'atom', verb: 'charSetCard', args: { faceUp: false, fromDeckTop: true, player: 'self', uid: '$self' } };
    const viaChain = semanticAbility({
      type: 'triggered', trigger: { hook: 'enter' },
      effect: { kind: 'chain', steps: [{ kind: 'choice', chooser: 'self', options: [inner] }] },
    });
    const plain = semanticAbility({
      type: 'triggered', trigger: { hook: 'enter' },
      effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'charSetCard', args: { fromDeckTop: true, player: 'self', uid: '$self' } }] },
    });
    expect(stableStringify(viaChain)).toBe(stableStringify(plain));
  });

  it('正規化は入力 object を mutate しない', () => {
    const ab = {
      type: 'triggered',
      trigger: { hook: 'leave:to-remove', matcherCondition: { kind: 'removedCharMatches', by: 'self', cause: 'contact-ap', side: 'opp' } },
      effect: { kind: 'choice', chooser: 'self', options: [sleepAtom] },
    };
    const before = JSON.stringify(ab);
    semanticAbility(ab);
    expect(JSON.stringify(ab)).toBe(before);
  });
});
