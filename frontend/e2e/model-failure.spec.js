import { test, expect } from '@playwright/test';

/**
 * The app must never fabricate detections. Before this was fixed, a failed
 * model download silently enabled a "test mode" that generated random fake
 * people (deliberately crossing the counting line), corrupting real counts
 * in production.
 */

async function drawLine(page) {
    const canvas = page.locator('#line-canvas');
    const box = await canvas.boundingBox();
    const midY = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.25, midY);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, midY, { steps: 5 });
    await page.mouse.up();
    expect(
        await page.evaluate(() => window.countInApp.lineManager.getLines().length)
    ).toBe(1);
}

test.describe('detection model failure', () => {
    // The fake media device only enumerates when camera permission is granted
    test.use({ permissions: ['camera'] });

    test('model download failure shows an error and counts stay at zero', async ({ page }) => {
        // Make every model source fail, as happens on fully blocked networks
        await page.route('**/tfjs-models/**', (route) => route.abort());
        await page.route('**/tfhub.dev/**', (route) => route.abort());
        await page.route('**/storage.googleapis.com/**', (route) => route.abort());
        await page.route('**/models/ssdlite/**', (route) => route.abort());

        await page.goto('/');
        await page.getByRole('button', { name: /Standalone/ }).click();

        // Wait for the (auto-selected) fake camera before confirming
        await expect(page.locator('.camera-item.selected')).toBeVisible({ timeout: 10_000 });
        await page.locator('#camera-confirm-btn').click();
        await expect(page.locator('#video')).toBeVisible();
        await page.getByRole('button', { name: 'Got it' }).click();

        await drawLine(page);

        // Start counting; every model source will fail
        await page.evaluate(() => window.countInApp.updateCountToggle());
        await page.locator('#count-toggle-btn').click();

        // The failure is surfaced with an explicit retry, not hidden
        await expect(page.locator('#model-retry-btn')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#loading-status')).toContainText('Could not load');

        // Give the (stopped) loop time to prove nothing is fabricated:
        // with the old test mode this produced a stream of phantom crossings
        await page.waitForTimeout(3000);
        await expect(page.locator('#total-count .stat-value')).toHaveText('0');
        await expect(page.locator('#in-count .stat-value')).toHaveText('0');
        await expect(page.locator('#out-count .stat-value')).toHaveText('0');

        // Retry path works (fails again while blocked, but stays honest)
        await page.locator('#model-retry-btn').click();
        await expect(page.locator('#model-retry-btn')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#total-count .stat-value')).toHaveText('0');

        // Dismissing leaves a working UI
        await page.locator('#model-close-btn').click();
        await expect(page.locator('#model-loading-modal')).not.toHaveClass(/active/);
        await expect(page.locator('#count-toggle-btn')).toBeVisible();
    });

    test('CDN blocked: the self-hosted model still loads', async ({ page }) => {
        test.setTimeout(90_000); // first tfjs chunk compile + 18MB weights

        // The model CDN is unreachable, but the weights ship with the app
        await page.route('**/tfjs-models/**', (route) => route.abort());
        await page.route('**/tfhub.dev/**', (route) => route.abort());
        await page.route('**/storage.googleapis.com/**', (route) => route.abort());

        await page.goto('/');
        await page.getByRole('button', { name: /Standalone/ }).click();
        await expect(page.locator('.camera-item.selected')).toBeVisible({ timeout: 10_000 });
        await page.locator('#camera-confirm-btn').click();
        await expect(page.locator('#video')).toBeVisible();
        await page.getByRole('button', { name: 'Got it' }).click();

        await drawLine(page);

        await page.evaluate(() => window.countInApp.updateCountToggle());
        await page.locator('#count-toggle-btn').click();

        // The loader completes and disappears; the model is usable
        await expect(page.locator('#model-loading-modal')).not.toHaveClass(/active/, {
            timeout: 60_000,
        });
        expect(
            await page.evaluate(() => window.countInApp.tracker.isModelLoaded)
        ).toBe(true);
        await expect(page.locator('#model-retry-btn')).toBeHidden();
    });
});
