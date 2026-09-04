import { describe, expect, it } from 'vitest';
import { B01005 } from '@/cards/ct-p01/B01005';
import { B01006 } from '@/cards/ct-p01/B01006';
import { B01012 } from '@/cards/ct-p01/B01012';
import { B01017 } from '@/cards/ct-p01/B01017';
import { B01020 } from '@/cards/ct-p01/B01020';
import { B01022 } from '@/cards/ct-p01/B01022';
import { B01027 } from '@/cards/ct-p01/B01027';
import { B01030 } from '@/cards/ct-p01/B01030';
import { B01036 } from '@/cards/ct-p01/B01036';
import { B01037 } from '@/cards/ct-p01/B01037';
import { B01039 } from '@/cards/ct-p01/B01039';
import { B01044 } from '@/cards/ct-p01/B01044';
import { B01047 } from '@/cards/ct-p01/B01047';
import { B01050 } from '@/cards/ct-p01/B01050';
import { B01051 } from '@/cards/ct-p01/B01051';
import { B01057 } from '@/cards/ct-p01/B01057';
import { B01058 } from '@/cards/ct-p01/B01058';
import { B01062 } from '@/cards/ct-p01/B01062';

function ability(card: { abilities: readonly { id: string }[] }, id: string) {
  return card.abilities.find(entry => entry.id === id);
}

describe('official QA Waves217-218: CT-P01 certification links', () => {
  it('pins Wave217 card contracts to their shipped descriptors', () => {
    // qa: card:B01005:79c468be8498ec14d70dccf4aeff3694581017ecb6ed62a2a0e9e3e637108d
    expect(ability(B01005, 'a1')).toMatchObject({ limit: { kind: 'turn', n: 1 } });
    // qa: card:B01006:b203c71c5a2ca8e57b36312ceddefe99ca091d50acdc98837bcbc27a0703471a
    expect(ability(B01006, 'a1')).toMatchObject({ type: 'continuous' });
    // qa: card:B01012:375faf5f577ba24091636b5b7eb7d6273023b10327c57dcd0886ad99c3dee26d
    // qa: card:B01012:7bea26c5fb60f8c35f8b384f22e30d4a147c8133b4c6e12b906b32673d6430bc
    expect(ability(B01012, 'a1')).toMatchObject({ type: 'triggered' });
    // qa: card:B01017:adc2aa670e2fa12a1d7ba1ed32a929213a3b6d05ecfa2a31d9dd2e19aefc28d7
    // qa: card:B01017:b2d6edcda9d8ff9b4508bd45fe365d41afd76529aabbd7dae53e3506a04d451b
    expect(ability(B01017, 'a1')).toMatchObject({ trigger: { hook: 'reasoning:end', selfOnly: true } });
    // qa: card:B01020:36b0be97fcbc88e1f05568f05cff4c660d81a332d3c598b8f6cd3a7b4c77afc2
    expect(ability(B01020, 'a1')).toMatchObject({ type: 'continuous' });
    // qa: card:B01022:4ae410ccc62047c3c27019d0b0b7b930f92b253ae22a6b9745311b1e32f50513
    expect(ability(B01022, 'a1')).toMatchObject({ type: 'triggered' });
    // qa: card:B01027:fe375c074866d59d884dc5cc67b709916380c640121c513db5ea722848714df7
    expect(ability(B01027, 'a1')).toMatchObject({ type: 'continuous' });
    // qa: card:B01030:2e115381449da4bd36176e8f839d982ebf1d682ecc867f7b664a176e22777520
    // qa: card:B01030:3e722a4128b2a51cb3f970f0c931d24942b7c40e5469a1f2734178b1227edb8c
    // qa: card:B01030:9474c860e1813431a2825cb39c4cbeb4796beb23881c66ec561f1de0da19e946
    expect(ability(B01030, 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove' }, limit: { kind: 'turn', n: 1 } });
  });

  it('pins Wave218 card contracts to their shipped descriptors', () => {
    // qa: card:B01036:1920ad860ef1135ce4afbc865ec7450ce3d48db16105f096f7d8b22874706464
    expect(ability(B01036, 'a1')).toMatchObject({ trigger: { hook: 'action:declare' }, limit: { kind: 'turn', n: 1 } });
    // qa: card:B01037:1920ad860ef1135ce4afbc865ec7450ce3d48db16105f096f7d8b22874706464
    expect(ability(B01037, 'a1')).toMatchObject({ trigger: { hook: 'action:declare' }, limit: { kind: 'turn', n: 1 } });
    // qa: card:B01039:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
    // qa: card:B01039:4421d3e9a65b9a1f82b4115f22ca416b5ffa024e5e871d28653663628a3f0534
    // qa: card:B01039:f46b0052b81efb6f222de48f039b09c034a5cdd905ff82953cf9d163ce82ebec
    expect(ability(B01039, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', selfOnly: true } });
    // qa: card:B01044:73ccad5eba4d1a353c8cce604e43ca0d83c1f2aef937dd0906ed0edff926fa0f
    expect(B01044.abilities).not.toHaveLength(0);
    // qa: card:B01047:36a8324e64bb363a2f90c2997622ad8675905ce2551ebb909bc2acbd2dd9b583
    expect(ability(B01047, 'a1')).toMatchObject({ trigger: { hook: 'action:end', selfOnly: true } });
    // qa: card:B01050:e0b31e47e7307a1105b6c6b992b65a784aa247e30fba0ba9070f8352d739058d
    expect(B01050.entersSleep).toBe(true);
    // qa: card:B01051:1571432d5c41e9a79e3b05e69814556ecf71c8317b904eeb2c4c05b09a01bffb
    expect(ability(B01051, 'a2')).toMatchObject({ type: 'continuous' });
    // qa: card:B01057:f4654de7db7b7ed93de8965c301fff81fef5022412009e5bc2b4d985099ce0dd
    expect(ability(B01057, 'b01057_set_t1')).toMatchObject({ trigger: { hook: 'leave:to-remove', selfOnly: true } });
    // qa: card:B01058:6fa1cbfe421b0118dfc2bb6e587b19d3d051ae0112d2c7b6f73e23fd8faf1080
    expect(ability(B01058, 'a1')).toMatchObject({ type: 'triggered' });
    // qa: card:B01062:a2402f0f947b17dedfb683450387bbde4289fb96ef27c31d22ccd970140ffc8a
    // qa: card:B01062:bd93a4215da265963e49dcb37160f02177a597ae13cbdfeb957995ec02c1b9de
    expect(ability(B01062, 'a2')).toMatchObject({ type: 'declared', limit: { kind: 'turn', n: 1 } });
  });
});
