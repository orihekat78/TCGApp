import { expect, test, type Page } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

const OFFICIAL_CARD_IMAGE =
  'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/CT-D08-001.jpg';
const UNEXPECTED_IMAGE = 'https://unexpected.test/conan-card.png';

async function loadImage(page: Page, url: string): Promise<{
  loaded: boolean;
  naturalWidth: number;
  naturalHeight: number;
}> {
  return page.evaluate(async (source) => {
    const image = document.createElement('img');
    image.alt = 'test image';
    return await new Promise((resolve) => {
      image.addEventListener(
        'load',
        () => resolve({ loaded: true, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }),
        { once: true },
      );
      image.addEventListener(
        'error',
        () => resolve({ loaded: false, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }),
        { once: true },
      );
      document.body.append(image);
      image.src = source;
    });
  }, url);
}

test.describe('setupGamePage network hermeticity', () => {
  test('fulfills official card images locally while the browser is offline', async ({ page }) => {
    await setupGamePage(page);
    await page.context().setOffline(true);

    await expect(loadImage(page, OFFICIAL_CARD_IMAGE)).resolves.toEqual({
      loaded: true,
      naturalWidth: 2,
      naturalHeight: 3,
    });
  });

  test('reports an unexpected failed request without external network access', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await page.context().setOffline(true);

    await expect(loadImage(page, UNEXPECTED_IMAGE)).resolves.toMatchObject({ loaded: false });
    await expect.poll(() => errors.some((error) => error.startsWith(`requestfailed: ${UNEXPECTED_IMAGE}`))).toBe(true);
  });
});
