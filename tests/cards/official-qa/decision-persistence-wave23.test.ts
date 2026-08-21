// qa: card:B03080:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B03080:3a8d218cc62bb0a90cf4d3932980a110db913b930175abf41908b0bb956f43b5
// qa: card:B03080:6f9e39e813dd420a6e0992c9b0ff99606674c4416e5ffd20099e5b41a25f1008
// qa: card:B03080:98ddd5063f7857683ecd61c63db5604fd6afc0f7d14ff8bda5d04e1597e43ebe
// qa: card:B03080:b06aa9135bc9418150fd8dd35da4a98ac1137277f30e9469cbb01be45bf7f78f
// qa: card:B05023:e2eb7c1b2a34a64cff5afde3981f9c512081cb8c7bf57b64a4ba5774678e31c9
// qa: card:B05062:5dc504829fc7fa362aaa13543652121d8435ac00844bf9a59b415e8971525d88
// qa: card:B05062:5e1d46e3fb96189bbfa298fc91a279db5d6b911f52375d384b0d11c5a6b8bffc
// qa: card:B05062:c44c3fbc3b30726e43189fc6b3744cc5f4eb22ccdbf7f10d66fc9b4e3b8a1be4
// qa: card:B05062:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:B07013:347ad10ce8061b4cbdccdb0860e1752fd4f879c7162d529a4fd4020eee21824c
// qa: card:B07013:f7ad053b1ba9f9a6ca978b64c95cdb72f331a8e1febd8e94bcd06e69fd340d1d
// qa: card:B07054:0bcbb181ef2cf2a48d13e2a78537e164803e7f0ef97a2a8ca772d8ce2b5aae8c
// qa: card:B07054:5dc504829fc7fa362aaa13543652121d8435ac00844bf9a59b415e8971525d88
// qa: card:B07076:2a847275894e970eb2d0e6e92f53d03b8a8c24915cbb770001ba6734a00cf260
// qa: card:B08029:0bcbb181ef2cf2a48d13e2a78537e164803e7f0ef97a2a8ca772d8ce2b5aae8c
// qa: card:B08029:82ba236a1affc9a48d48c8b59711d42b7d6ee9be7c4c72589983ce1d899477a1
// qa: card:B08029:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:B09019:0ae3329b249fa56d9f5b74d8cc5763d116f5816852e8f6c82c9f8b3f7ef24ac4
// qa: card:B09019:94230fa7173ff6d4f486143e4b3bc389c9523e5a672a9cb74422dc537b6a8dc2
// qa: card:B09019:c9d1abbedddbedbfad74851f5da4e68d45940c5dc7b1a674e2aa635443a4df5e
// qa: card:B09019:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B09019:e8e3445ac6139f21bb8ab2dd70734b6ea03331a372bfd54f70907a129e263392
// qa: card:B09052:45a28272794215b6465b92629940788c48e8cb3de486869a26a5a34e1a4f6a73
// qa: card:B09052:52e25d1fb9d3623390ecb00ccb1047978985d54514cf0287453e6c0e3105c82a
// qa: card:B09052:e97cb4e35b90d68e7b4a2992199484b5e63071cf64f8fab5234e48eafbab03b6
// qa: card:B09052:ee061ffcf4652d834b2aa83508fd512dedb3e0a2d8251c3d26d6ef0844a5fe36
// qa: card:B10060:5677e0ec7d635aec71e9eadc6367fc1ebc0e2d875c9a3482ea83518dd549ef9d
// qa: card:B10096:22aaf9ba5e384ee444adeadb5ffb7b5c97b7a4e75ccbac8c297b8c86d3e85f3f
// qa: card:B10096:5b16212aa597d2f97c4bc97c7904b2ca496da7752c5ea79d5dbb4ef907fe083f
// qa: card:B10096:c34fb03dbba3939eb1b2e8e0666f56e3b7fc1073dbdb3535cda372611db4dc52

import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/cards';
import { B03080 } from '@/cards/ct-p03/B03080';
import { B03080P } from '@/cards/ct-p03/B03080P';
import { B05023 } from '@/cards/ct-p05/B05023';
import { B05023P } from '@/cards/ct-p05/B05023P';
import { B05062 } from '@/cards/ct-p05/B05062';
import { B07013 } from '@/cards/ct-p07/B07013';
import { B07054 } from '@/cards/ct-p07/B07054';
import { B07054P } from '@/cards/ct-p07/B07054P';
import { B07076 } from '@/cards/ct-p07/B07076';
import { B07076P } from '@/cards/ct-p07/B07076P';
import { B08029 } from '@/cards/ct-p08/B08029';
import { B08029P } from '@/cards/ct-p08/B08029P';
import { B09019 } from '@/cards/ct-p09/B09019';
import { B09019P } from '@/cards/ct-p09/B09019P';
import { B09052 } from '@/cards/ct-p09/B09052';
import { B09052P } from '@/cards/ct-p09/B09052P';
import { B10060, B10060P } from '@/cards/ct-p10/B10060';
import { B10096, B10096P } from '@/cards/ct-p10/B10096';
import { char as readChar } from '@/engine/read/char';
import type { CardDef } from '@/engine/types';
import { runCardScenario } from '../../helpers/card-probe-harness';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

const RED_HOST = character('W23_RED_HOST');
const MOURI = character('W23_MOURI', { names: ['毛利小五郎'], colors: ['青'], traits: ['毛利探偵事務所'] });
const SLEEP_TARGET = character('W23_SLEEP_TARGET', { level: 7 });
const DISCARD = character('W23_DISCARD', { level: 1 });
const KYO_ENTRY = character('W23_KYO_ENTRY', { names: ['京極真'], colors: ['白'], level: 7 });
const KYO_HIGH = character('W23_KYO_HIGH', { names: ['京極真'], colors: ['白'], level: 8 });
const SUZUKI_ONE = character('W23_SUZUKI_ONE', { colors: ['白'], traits: ['鈴木財閥'], level: 4 });
const SUZUKI_TWO = character('W23_SUZUKI_TWO', { colors: ['白'], traits: ['鈴木財閥'], level: 5 });
const CONAN = character('W23_CONAN', { names: ['江戸川コナン'], colors: ['青'] });
const STUNNED = character('W23_STUNNED', { colors: ['青'] });
const KAITOU = character('W23_KAITOU', { names: ['黒羽快斗'], colors: ['白'], traits: ['怪盗'] });
const AOKO = character('W23_AOKO', { names: ['中森青子'], colors: ['白'] });
const RECOVERY = character('W23_RECOVERY', { colors: ['青'] });
const RED_HAND_ONE = character('W23_RED_HAND_ONE');
const RED_HAND_TWO = character('W23_RED_HAND_TWO');
const IORI = character('W23_IORI', { names: ['伊織無我'], colors: ['緑'], level: 7 });
const MOMIJI = character('W23_MOMIJI', { names: ['大岡紅葉'], colors: ['緑'], level: 7 });
const KESSEI = character('W23_KESSEI', { names: ['結成 少年探偵団'], colors: ['青'] });
const KIDS = Array.from({ length: 5 }, (_, index) => character(`W23_KID_${index + 1}`, {
  names: [`少年${index + 1}`], colors: ['青'], traits: ['少年探偵団'], level: 4,
}));
const WHITE_ENTRY = character('W23_WHITE_ENTRY', { names: ['白い登場者'], colors: ['白'], level: 4 });
const NAME_SOURCE = character('W23_NAME_SOURCE', { names: ['毛利蘭'], colors: ['青'], level: 8 });
const PLAIN_ENTRY = character('W23_PLAIN_ENTRY', { colors: ['赤'], level: 4 });
const REMOVE_VICTIM = character('W23_REMOVE_VICTIM', { colors: ['青'], level: 4 });
const BLACK_CUTIN = character('W23_BLACK_CUTIN', { colors: ['黒'], level: 4, keywords: ['カットイン'] });
const BLACK_ENTRY = character('W23_BLACK_ENTRY', { colors: ['黒'], level: 4, keywords: ['カットイン'] });

const FIXTURES = [
  RED_HOST, MOURI, SLEEP_TARGET, DISCARD, KYO_ENTRY, KYO_HIGH, SUZUKI_ONE,
  SUZUKI_TWO, CONAN, STUNNED, KAITOU, AOKO, RECOVERY, RED_HAND_ONE,
  RED_HAND_TWO, IORI, MOMIJI, KESSEI, ...KIDS, WHITE_ENTRY, NAME_SOURCE,
  PLAIN_ENTRY, REMOVE_VICTIM, BLACK_CUTIN, BLACK_ENTRY,
];

describe('official QA Wave 23 decision persistence', () => {
  it('B03080 take branch still executes the mandatory set-card tail', () => {
    const state = runCardScenario(B03080, FIXTURES, {
      name: 'B03080 optional take then mandatory set',
      setup: {
        caseColors: ['赤'], fileCount: 5, hand: [B03080.id],
        selfScene: [{ cardId: RED_HOST.id, uid: 'red-host' }],
      },
      drive: { kind: 'event-use', cardId: B03080.id },
      script: ['optional:take', { pickUid: 'red-host' }],
      expect: [],
    });
    expect(state.players.opp.evidence).toHaveLength(1);
    expect(state.players.self.scene[0]!.setCards).toEqual([
      expect.objectContaining({ cardId: B03080.id }),
    ]);
  });

  it('B03080 decline branch still executes the mandatory set-card tail', () => {
    const state = runCardScenario(B03080, FIXTURES, {
      name: 'B03080 optional decline then mandatory set',
      setup: {
        caseColors: ['赤'], fileCount: 5, hand: [B03080.id],
        selfScene: [{ cardId: RED_HOST.id, uid: 'red-host' }],
      },
      drive: { kind: 'event-use', cardId: B03080.id },
      script: ['optional:decline', { pickUid: 'red-host' }],
      expect: [],
    });
    expect(state.players.opp.evidence).toHaveLength(0);
    expect(state.players.self.scene[0]!.setCards[0]?.cardId).toBe(B03080.id);
  });

  it('B05023 performs both ordered effects when Mouri Kogoro is present', () => {
    const state = runCardScenario(B05023, FIXTURES, {
      name: 'B05023 conditional all branch',
      setup: {
        caseColors: ['青'], fileCount: 5, hand: [B05023.id], deckSize: 6,
        selfScene: [{ cardId: MOURI.id, uid: 'mouri' }],
        oppScene: [{ cardId: SLEEP_TARGET.id, uid: 'sleep-target' }],
      },
      drive: { kind: 'event-use', cardId: B05023.id },
      script: [{ pickUid: 'mouri' }, { pickUid: 'sleep-target' }],
      expect: [
        { kind: 'state', uid: 'sleep-target', state: 'sleep' },
        { kind: 'deckDelta', side: 'self', n: -1 },
      ],
    });
    expect(readChar.hasKeyword(state, 'mouri', '突撃')).toBe(true);
  });

  it('B05062 four-card gate preserves draw-discard, entry, and sleep order', () => {
    const state = runCardScenario(B05062, FIXTURES, {
      name: 'B05062 all-three gate',
      setup: {
        caseColors: ['白'], fileCount: 7, hand: [B05062.id, DISCARD.id], deckSize: 6,
        remove: [KYO_ENTRY.id, KYO_HIGH.id, SUZUKI_ONE.id, SUZUKI_TWO.id],
        oppScene: [{ cardId: SLEEP_TARGET.id, uid: 'sleep-target' }],
      },
      drive: { kind: 'event-use', cardId: B05062.id },
      script: [
        { pickCardId: DISCARD.id },
        { pickCardId: KYO_ENTRY.id },
        { pickUid: 'sleep-target' },
      ],
      expect: [
        { kind: 'zone', side: 'self', zone: 'scene', cardId: KYO_ENTRY.id, present: true },
        { kind: 'state', uid: 'sleep-target', state: 'sleep' },
        { kind: 'candidatesExclude', pickIndex: 1, cardId: KYO_HIGH.id },
      ],
    });
    expect(state.players.self.scene.some(char => char.cardId === KYO_ENTRY.id)).toBe(true);
  });

  it('B07013 Conan replacement executes all three effects in order', () => {
    const state = runCardScenario(B07013, FIXTURES, {
      name: 'B07013 Conan all-three replacement',
      setup: {
        caseColors: ['青'], fileCount: 5, hand: [B07013.id],
        selfScene: [
          { cardId: CONAN.id, uid: 'conan' },
          { cardId: STUNNED.id, uid: 'stunned', state: 'stun' },
        ],
        oppScene: [{ cardId: KAITOU.id, uid: 'kaitou' }],
        remove: [RECOVERY.id],
      },
      drive: { kind: 'event-use', cardId: B07013.id },
      script: [
        { choiceIndex: 0 }, { pickUid: 'conan' }, { pickUid: 'stunned' },
        { pickUid: 'kaitou' }, { pickCardId: RECOVERY.id },
      ],
      expect: [
        { kind: 'state', uid: 'stunned', state: 'sleep' },
        { kind: 'state', uid: 'kaitou', state: 'stun' },
        { kind: 'zone', side: 'self', zone: 'hand', cardId: RECOVERY.id, present: true },
      ],
    });
    expect(state.players.self.scene.find(char => char.uid === 'conan')?.state).toBe('sleep');
  });

  it.each(['sleep', 'stun'] as const)(
    'B07013 does not unlock all three effects from a Conan already %s',
    (conanState) => {
      const state = runCardScenario(B07013, FIXTURES, {
        name: `B07013 existing ${conanState} Conan`,
        setup: {
          caseColors: ['青'], fileCount: 5, hand: [B07013.id],
          selfScene: [
            { cardId: CONAN.id, uid: 'conan', state: conanState },
            { cardId: STUNNED.id, uid: 'stunned', state: 'stun' },
          ],
          oppScene: [{ cardId: KAITOU.id, uid: 'kaitou' }],
          remove: [RECOVERY.id],
        },
        drive: { kind: 'event-use', cardId: B07013.id },
        script: [{ choiceIndex: 0 }],
        expect: [],
      });

      expect(state.players.self.scene.find(char => char.uid === 'conan')?.state).toBe(conanState);
      expect(state.players.self.scene.find(char => char.uid === 'stunned')?.state).toBe('stun');
      expect(state.players.opp.scene.find(char => char.uid === 'kaitou')?.state).toBe('active');
      expect(state.players.self.remove).toContain(RECOVERY.id);
    },
  );

  it('B07054 conditional branch keeps bindings across all three choices', () => {
    const state = runCardScenario(B07054, FIXTURES, {
      name: 'B07054 all-three branch',
      setup: {
        caseColors: ['白'], partnerColors: ['白'], fileCount: 5, hand: [B07054.id],
        selfScene: [
          { cardId: KAITOU.id, uid: 'kaito' },
          { cardId: AOKO.id, uid: 'aoko' },
        ],
        oppScene: [{ cardId: SLEEP_TARGET.id, uid: 'sleep-target', state: 'sleep' }],
      },
      drive: { kind: 'event-use', cardId: B07054.id },
      script: [{ pickUid: 'kaito' }, { pickUid: 'sleep-target' }, { pickUid: 'aoko' }],
      expect: [
        { kind: 'apDelta', uid: 'kaito', n: 2000 },
        { kind: 'state', uid: 'sleep-target', state: 'stun' },
      ],
    });
    expect(state.players.self.scene.find(char => char.uid === 'aoko')?.turnEffects.actionTargetsActive).toBe(true);
  });

  it('B07076 second choice removes the hand, draws four, and applies both bans', () => {
    const state = runCardScenario(B07076, FIXTURES, {
      name: 'B07076 discard-all ban branch',
      setup: {
        caseColors: ['赤'], partnerColors: ['赤'], fileCount: 7,
        hand: [B07076.id, RED_HAND_ONE.id, RED_HAND_TWO.id], deckSize: 6,
      },
      drive: { kind: 'event-use', cardId: B07076.id },
      script: [{ choiceIndex: 1 }],
      expect: [{ kind: 'deckDelta', side: 'self', n: -4 }],
    });
    expect(state.players.self.hand).toHaveLength(4);
    expect(state.turnState.opp.cutinBanned).toBe(true);
    expect(state.turnState.opp.disguiseBanned).toBe(true);
  });

  it('B08029 preserves the entered Iori binding through its choice continuation', () => {
    const state = runCardScenario(B08029, FIXTURES, {
      name: 'B08029 action-target grant and Momiji recovery',
      setup: {
        caseColors: ['緑'], partnerColors: ['緑'], fileCount: 8, hand: [B08029.id],
        remove: [IORI.id, MOMIJI.id],
      },
      drive: { kind: 'event-use', cardId: B08029.id },
      script: [{ choiceIndex: 1 }, { pickCardId: IORI.id }, { pickCardId: MOMIJI.id }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'scene', cardId: IORI.id, present: true },
        { kind: 'zone', side: 'self', zone: 'hand', cardId: MOMIJI.id, present: true },
      ],
    });
    expect(state.players.self.scene.find(char => char.cardId === IORI.id)?.turnEffects.actionTargetsActive).toBe(true);
  });

  it('B09019 decline still applies its mandatory next-hint ban', () => {
    const state = runCardScenario(B09019, FIXTURES, {
      name: 'B09019 decline mandatory tail',
      setup: { caseColors: ['青'], fileCount: 7, hand: [B09019.id] },
      drive: { kind: 'event-use', cardId: B09019.id },
      script: ['optional:decline'],
      expect: [],
    });
    expect(state.turnState.self.nextHintBanned).toBe(true);
    expect(state.players.self.file).toHaveLength(7);
  });

  it('B09019 take branch enters five distinct children before its conditional removal', () => {
    const state = runCardScenario(B09019, FIXTURES, {
      name: 'B09019 five-entry continuation',
      setup: {
        caseColors: ['青'], fileCount: 7, hand: [B09019.id],
        selfScene: [{ cardId: KESSEI.id, uid: 'kessei' }],
        remove: KIDS.map(card => card.id),
      },
      drive: { kind: 'event-use', cardId: B09019.id },
      script: [
        'optional:take', { pickUid: 'kessei' },
        { pickCardIds: KIDS.map(card => card.id) }, { pickCardId: KIDS[0]!.id },
      ],
      expect: [{ kind: 'zone', side: 'self', zone: 'remove', cardId: KIDS[0]!.id, present: true }],
    });
    expect(state.players.self.file).toHaveLength(6);
    expect(state.players.self.scene).toHaveLength(4);
    expect(state.players.self.scene.every(char => char.state === 'sleep')).toBe(true);
    expect(state.turnState.self.nextHintBanned).toBe(true);
  });

  it('B09052 resumes from entry into the optional name-copy branch', () => {
    const state = runCardScenario(B09052, FIXTURES, {
      name: 'B09052 entry then optional rename',
      setup: {
        caseColors: ['白'], fileCount: 4, hand: [B09052.id, WHITE_ENTRY.id],
        selfScene: [{ cardId: NAME_SOURCE.id, uid: 'name-source' }],
      },
      drive: { kind: 'event-use', cardId: B09052.id },
      script: [{ pickCardId: WHITE_ENTRY.id }, 'optional:take', { pickUid: 'name-source' }],
      expect: [{ kind: 'zone', side: 'self', zone: 'scene', cardId: WHITE_ENTRY.id, present: true }],
    });
    const entered = state.players.self.scene.find(char => char.cardId === WHITE_ENTRY.id)!;
    expect(
      entered.turnEffects.nameOverride,
      JSON.stringify({ turnEffects: entered.turnEffects, log: state.log.slice(-8) }),
    ).toBe(NAME_SOURCE.names[0]);
  });

  it('B10060 suppresses child decisions when no character entered', () => {
    const state = runCardScenario(B10060, FIXTURES, {
      name: 'B10060 zero-entry child suppression',
      setup: { caseColors: ['赤', '黄'], fileCount: 7, hand: [B10060.id] },
      drive: { kind: 'event-use', cardId: B10060.id },
      expect: [{ kind: 'noPromptSurfaced' }],
    });
    expect(state.players.self.scene).toHaveLength(0);
  });

  it('B10060 keeps its entry binding through choice and optional resolution', () => {
    const state = runCardScenario(B10060, FIXTURES, {
      name: 'B10060 entry choice optional continuation',
      setup: {
        caseColors: ['赤', '黄'], fileCount: 7, hand: [B10060.id],
        remove: [PLAIN_ENTRY.id],
        oppScene: [{ cardId: REMOVE_VICTIM.id, uid: 'remove-victim' }],
      },
      drive: { kind: 'event-use', cardId: B10060.id },
      script: [
        { pickCardId: PLAIN_ENTRY.id }, { choiceIndex: 0 },
        'optional:take', { pickUid: 'remove-victim' },
      ],
      expect: [
        { kind: 'zone', side: 'self', zone: 'scene', cardId: PLAIN_ENTRY.id, present: true },
        { kind: 'zone', side: 'opp', zone: 'remove', cardId: REMOVE_VICTIM.id, present: true },
      ],
    });
    expect(state.players.self.scene.find(char => char.cardId === PLAIN_ENTRY.id)?.state).toBe('sleep');
  });

  it('B10096 one matching mill resumes into its selected entry branch', () => {
    const state = runCardScenario(B10096, FIXTURES, {
      name: 'B10096 optional mill conditional choice',
      setup: {
        caseColors: ['黒'], partnerColors: ['黒'], fileCount: 6,
        hand: [B10096.id, BLACK_ENTRY.id],
        deckTop: [BLACK_CUTIN.id, '__DECK_S_0', '__DECK_S_1'],
      },
      drive: { kind: 'event-use', cardId: B10096.id },
      script: ['optional:take', { choiceIndex: 1 }, { pickCardId: BLACK_ENTRY.id }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'remove', cardId: BLACK_CUTIN.id, present: true },
        { kind: 'zone', side: 'self', zone: 'scene', cardId: BLACK_ENTRY.id, present: true },
      ],
    });
    expect(state.players.self.scene.some(char => char.cardId === BLACK_ENTRY.id)).toBe(true);
  });
});

describe('Wave 23 exact printing parity', () => {
  const groups: Array<{ base: CardDef; alternates: CardDef[]; ids: string[] }> = [
    { base: B03080, alternates: [B03080P], ids: ['B03080', 'B03080P'] },
    { base: B05023, alternates: [B05023P], ids: ['B05023', 'B05023P'] },
    { base: B05062, alternates: [], ids: ['B05062'] },
    { base: B07013, alternates: [], ids: ['B07013'] },
    { base: B07054, alternates: [B07054P], ids: ['B07054', 'B07054P'] },
    { base: B07076, alternates: [B07076P], ids: ['B07076', 'B07076P'] },
    { base: B08029, alternates: [B08029P], ids: ['B08029', 'B08029P'] },
    { base: B09019, alternates: [B09019P], ids: ['B09019', 'B09019P'] },
    { base: B09052, alternates: [B09052P], ids: ['B09052', 'B09052P'] },
    { base: B10060, alternates: [B10060P], ids: ['B10060', 'B10060P'] },
    { base: B10096, alternates: [B10096P], ids: ['B10096', 'B10096P'] },
  ];

  for (const { base, alternates, ids } of groups) {
    it(`${base.id} has the exact shipped printing set and shared abilities`, () => {
      const actual = ALL_CARDS
        .filter(card => card.id === base.id || card.id.startsWith(`${base.id}P`))
        .map(card => card.id)
        .sort();
      expect(actual).toEqual([...ids].sort());
      for (const alternate of alternates) {
        expect(JSON.stringify(alternate.abilities)).toBe(JSON.stringify(base.abilities));
      }
    });
  }
});
