import { test, expect, devices } from '@playwright/test';

/**
 * The camera station (mobile, connected to a hub) must run real detection:
 * the model loads, the loop runs, and a crossing updates the local count and
 * reaches the hub. Standalone and camera mode share the pipeline, so a
 * regression here means the mobile camera mode silently does nothing.
 */
test.describe('camera station detection pipeline', () => {
    test('model loads, counting runs, and a crossing reaches the hub', async ({
        browser,
    }) => {
        test.setTimeout(120_000); // first tfjs compile + 18MB weights on mobile emulation

        // Desktop hub
        const desktop = await browser.newContext();
        const hubPage = await desktop.newPage();
        await hubPage.goto('/');
        await hubPage.getByRole('button', { name: /Hub Dashboard/ }).click();
        await expect(hubPage.locator('#hub-view')).toBeVisible();
        const token = await hubPage.evaluate(() =>
            localStorage.getItem('countin-hub-pairing-token')
        );

        // Mobile camera station via QR
        const mobile = await browser.newContext({
            ...devices['Pixel 7'],
            permissions: ['camera'],
        });
        const page = await mobile.newPage();
        page.on('pageerror', (e) => console.log('[pageerror]', e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') console.log('[console.error]', m.text());
        });

        await page.goto(`/?pair=${token}`);
        await expect(page.locator('#camera-pairing')).toBeVisible();
        await page.locator('#camera-name-input').fill('Detection Cam');
        await page.locator('#pair-camera-btn').click();

        await expect(page.locator('#camera-connected')).toBeVisible();
        await expect(page.locator('.camera-item.selected')).toBeVisible({ timeout: 10_000 });
        await page.locator('#camera-confirm-btn').click();
        await expect(page.locator('#video')).toBeVisible();
        await page.getByRole('button', { name: 'Got it' }).click();

        // Wait for the feed so the canvases are sized before drawing
        await page.waitForFunction(
            () => {
                const v = document.getElementById('video');
                return v && v.readyState >= 2 && v.videoWidth > 0;
            },
            null,
            { timeout: 30_000 }
        );

        // Draw one counting line
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

        // Start counting; the model must load (self-hosted weights, CDN blocked)
        await page.route('**/tfjs-models/**', (route) => route.abort());
        await page.route('**/tfhub.dev/**', (route) => route.abort());
        await page.route('**/storage.googleapis.com/**', (route) => route.abort());
        await page.route('**/cdn.jsdelivr.net/**', (route) => route.abort());

        await page.evaluate(() => window.countInApp.updateCountToggle());
        await page.locator('#count-toggle-bar').click();

        // The loader completes: model loaded, counting loop running
        await expect(page.locator('#model-loading-modal')).not.toHaveClass(/active/, {
            timeout: 60_000,
        });
        const pipeline = await page.evaluate(() => ({
            modelLoaded: window.countInApp.tracker.isModelLoaded,
            running: window.countInApp.isRunning,
            adapterFailed: window.rfdetrAdapter.getState().loadFailed,
        }));
        expect(pipeline.modelLoaded).toBe(true);
        expect(pipeline.running).toBe(true);
        expect(pipeline.adapterFailed).toBe(false);

        // The live feed is being processed without errors
        await page.waitForTimeout(2000);
        expect(
            await page.evaluate(() => window.countInApp.tracker.isModelLoaded)
        ).toBe(true);

        // Simulate a detection crossing the drawn line, exactly as the
        // camera-mode crossing handler would be invoked by the tracker.
        await page.evaluate(() => {
            const app = window.countInApp;
            const line = app.lineManager.getLines()[0];
            app.lineManager.onLineCrossed({
                lineId: line.id,
                lineName: line.name,
                personId: 'e2e-1',
                direction: 'in',
                position: [line.start.x, line.start.y],
            });
        });

        // The camera's own stat reflects the crossing
        await expect(page.locator('#camera-total-in')).toHaveText('1', { timeout: 5_000 });

        // And the hub receives the real-time count update
        await expect(hubPage.locator('#hub-total-in')).toHaveText('1', { timeout: 10_000 });

        await desktop.close();
        await mobile.close();
    });
});
