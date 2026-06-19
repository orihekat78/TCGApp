// E2E (Task5): 現場カードの reflow 移動トゥイーン (FLIP) の実機検証。
//
// 検証する「機能 = カードテキスト文言」ではなく UI polish の挙動契約:
//   1. 現場の実カードに data-flip-id が付与されている (ゴーストには付かない)。
//   2. 並びが変わる reflow (先頭カード除去 → 後続が左へ詰める) で、生き残ったカードに
//      useFlipAnimation が invert transform (translate(...)) を一旦適用し、次フレームで解除する。
//   3. 解決後は inline transform が空に戻り (CSS base へ)、カードは実際に左へ移動している。
//   4. 一連の操作で console error 0。
//
// 設計: MutationObserver で .board-content の style 変化を記録し、invert→clear のシーケンスを
// タイミング非依存に捕捉する (rAF の正確な発火時刻に依存しない)。

import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState } from './helpers';

// createSampleGameState の self.scene[0] をテンプレに 3 枚 (flipA/B/C) を作る。
function sceneThree(gs: { players: { self: { scene: unknown[] } } }): void {
  const arr = gs.players.self.scene as Array<Record<string, unknown>>;
  const tpl = arr[0];
  if (!tpl) throw new Error('sample has no self.scene[0] template');
  const mk = (uid: string, order: number): Record<string, unknown> => {
    const c = JSON.parse(JSON.stringify(tpl)) as Record<string, unknown>;
    c.uid = uid;
    c.enterOrder = order;
    c.state = 'active';
    c.isNamed = false;
    return c;
  };
  gs.players.self.scene = [mk('flipA', 1), mk('flipB', 2), mk('flipC', 3)];
}

// 先頭 (flipA) を除去 → flipB/flipC が左へ詰める reflow。
function sceneTwo(gs: { players: { self: { scene: unknown[] } } }): void {
  const arr = gs.players.self.scene as Array<Record<string, unknown>>;
  const tpl = arr[0];
  if (!tpl) throw new Error('sample has no self.scene[0] template');
  const mk = (uid: string, order: number): Record<string, unknown> => {
    const c = JSON.parse(JSON.stringify(tpl)) as Record<string, unknown>;
    c.uid = uid;
    c.enterOrder = order;
    c.state = 'active';
    c.isNamed = false;
    return c;
  };
  gs.players.self.scene = [mk('flipB', 2), mk('flipC', 3)];
}

// 回転 (sleep) カードを含む 3 枚。中央 flipS だけ sleep。
function sceneThreeWithSleep(gs: { players: { self: { scene: unknown[] } } }): void {
  const arr = gs.players.self.scene as Array<Record<string, unknown>>;
  const tpl = arr[0];
  if (!tpl) throw new Error('sample has no self.scene[0] template');
  const mk = (uid: string, order: number, state: string): Record<string, unknown> => {
    const c = JSON.parse(JSON.stringify(tpl)) as Record<string, unknown>;
    c.uid = uid;
    c.enterOrder = order;
    c.state = state;
    c.isNamed = false;
    return c;
  };
  gs.players.self.scene = [mk('flipA', 1, 'active'), mk('flipS', 2, 'sleep'), mk('flipC', 3, 'active')];
}

// flipA 除去 → flipS(sleep)/flipC が左へ詰める。
function sceneTwoWithSleep(gs: { players: { self: { scene: unknown[] } } }): void {
  const arr = gs.players.self.scene as Array<Record<string, unknown>>;
  const tpl = arr[0];
  if (!tpl) throw new Error('sample has no self.scene[0] template');
  const mk = (uid: string, order: number, state: string): Record<string, unknown> => {
    const c = JSON.parse(JSON.stringify(tpl)) as Record<string, unknown>;
    c.uid = uid;
    c.enterOrder = order;
    c.state = state;
    c.isNamed = false;
    return c;
  };
  gs.players.self.scene = [mk('flipS', 2, 'sleep'), mk('flipC', 3, 'active')];
}

test('Task5 FLIP: surviving scene cards slide on reflow (invert applied then cleared)', async ({ page }) => {
  const { errors } = await setupGamePage(page);

  await buildGameState(page, sceneThree);
  await page.waitForSelector('[data-flip-id="flipB"]');
  await page.waitForSelector('[data-flip-id="flipC"]');

  // 契約1: 実カードに data-flip-id、ゴースト/空スロットには付かない
  const flipIds = await page.evaluate(() =>
    [...document.querySelectorAll('[data-flip-id]')].map((e) => e.getAttribute('data-flip-id')),
  );
  expect(flipIds).toEqual(expect.arrayContaining(['flipA', 'flipB', 'flipC']));

  const centerC0 = await page.evaluate(() => {
    const el = document.querySelector('[data-flip-id="flipC"]') as HTMLElement;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  await page.screenshot({ path: '.claude/reports/task5-flip-before.png' });

  // .board-content の style 変化 (= inline transform 書き換え) を記録
  await page.evaluate(() => {
    const w = window as unknown as { __flipLog: Array<{ fid: string; transform: string }>; __flipObs?: MutationObserver };
    w.__flipLog = [];
    const root = document.querySelector('.board-content');
    if (!root) throw new Error('.board-content not found');
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.attributeName !== 'style') continue;
        const el = m.target as HTMLElement;
        const fid = el.getAttribute && el.getAttribute('data-flip-id');
        if (fid) w.__flipLog.push({ fid, transform: el.style.transform });
      }
    });
    obs.observe(root, { attributes: true, subtree: true, attributeFilter: ['style'] });
    w.__flipObs = obs;
  });

  // reflow を発火
  await buildGameState(page, sceneTwo);
  await page.waitForFunction(() => !document.querySelector('[data-flip-id="flipA"]'));

  // 契約2: 生き残った flipB/flipC に invert translate が適用された
  const log = await page.evaluate(
    () => (window as unknown as { __flipLog: Array<{ fid: string; transform: string }> }).__flipLog,
  );
  const hadInvert = (fid: string): boolean =>
    log.some(
      (e) => e.fid === fid && /translate\(/.test(e.transform) && !/translate\(0px,\s*0px\)/.test(e.transform),
    );
  expect(hadInvert('flipB'), 'flipB が invert translate を受けた').toBeTruthy();
  expect(hadInvert('flipC'), 'flipC が invert translate を受けた').toBeTruthy();

  // 契約3: ゴースト (420ms) 消滅 + transition 完了まで待ってから最終状態を確認する。
  //   除去カードはゴーストとして一時的に枠を占有し列を混雑させるため、最終的な「左詰め」の
  //   位置確定はゴースト消滅後 (childList 変化 → 2 回目の FLIP) になる。
  await page.waitForTimeout(800);
  const finalC = await page.evaluate(() => {
    const el = document.querySelector('[data-flip-id="flipC"]') as HTMLElement;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, transform: el.style.transform };
  });
  // inline transform は空 (CSS base) に戻っている
  expect(finalC.transform, 'flipC の inline transform は解除済み').toBe('');
  // 実位置は左へ詰めた (slot index2 → index1)
  expect(finalC.x, 'flipC は reflow で左へ移動した').toBeLessThan(centerC0.x - 10);

  await page.screenshot({ path: '.claude/reports/task5-flip-after.png' });

  // 契約4: console error 0
  expect(errors).toEqual([]);
});

test('Task5 FLIP: sleep カードが reflow しても回転を保ったままスライドする (matrix 合成)', async ({ page }) => {
  const { errors } = await setupGamePage(page);

  await buildGameState(page, sceneThreeWithSleep);
  await page.waitForSelector('[data-flip-id="flipS"]');
  // enter アニメ (280ms) 完了を待ってから reflow させ、resting transform を sleep の rotate(-90) にする
  await page.waitForTimeout(350);

  // sleep カードの computed transform が回転を持つことを確認 (前提)
  const sleepBefore = await page.evaluate(() => {
    const el = document.querySelector('[data-flip-id="flipS"]') as HTMLElement;
    return { hasSleepClass: el.classList.contains('sleep'), computed: getComputedStyle(el).transform };
  });
  expect(sleepBefore.hasSleepClass, 'flipS は sleep クラスを持つ').toBeTruthy();
  expect(sleepBefore.computed, 'flipS の computed transform は matrix(回転)').toMatch(/matrix/);

  // style 変化を記録
  await page.evaluate(() => {
    const w = window as unknown as { __flipLog2: Array<{ fid: string; transform: string }> };
    w.__flipLog2 = [];
    const root = document.querySelector('.board-content');
    if (!root) throw new Error('.board-content not found');
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.attributeName !== 'style') continue;
        const el = m.target as HTMLElement;
        const fid = el.getAttribute && el.getAttribute('data-flip-id');
        if (fid) w.__flipLog2.push({ fid, transform: el.style.transform });
      }
    });
    obs.observe(root, { attributes: true, subtree: true, attributeFilter: ['style'] });
  });

  await buildGameState(page, sceneTwoWithSleep);
  await page.waitForFunction(() => !document.querySelector('[data-flip-id="flipA"]'));

  // invert に「translate + 回転 matrix」が合成されている (回転を打ち消していない)
  const log = await page.evaluate(
    () => (window as unknown as { __flipLog2: Array<{ fid: string; transform: string }> }).__flipLog2,
  );
  const composed = log.find(
    (e) => e.fid === 'flipS' && /translate\(/.test(e.transform) && /matrix/.test(e.transform),
  );
  expect(composed, 'flipS の invert は translate + 回転 matrix を合成している').toBeTruthy();

  // settle 後も sleep のまま (回転保持) で inline transform は解除
  await page.waitForTimeout(800);
  const sleepAfter = await page.evaluate(() => {
    const el = document.querySelector('[data-flip-id="flipS"]') as HTMLElement;
    return { hasSleepClass: el.classList.contains('sleep'), inline: el.style.transform };
  });
  expect(sleepAfter.hasSleepClass, 'flipS は reflow 後も sleep (回転) を保つ').toBeTruthy();
  expect(sleepAfter.inline, 'flipS の inline transform は解除済み').toBe('');

  expect(errors).toEqual([]);
});
