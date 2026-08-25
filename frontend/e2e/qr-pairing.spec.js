import { test, expect, devices } from '@playwright/test';

test.describe('QR code pairing flow (mobile scans hub QR)', () => {
    test('mobile scans QR link, names the camera, pairs and counts to the hub', async ({
        browser,
    }) => {
        // Desktop: create a hub dashboard
        const desktop = await browser.newContext();
        const hubPage = await desktop.newPage();
        await hubPage.goto('/');
        await hubPage.getByRole('button', { name: /Hub Dashboard/ }).click();
        await expect(hubPage.locator('#hub-view')).toBeVisible();

        // The QR code encodes exactly this token
        const token = await hubPage.evaluate(() =>
            localStorage.getItem('countin-hub-pairing-token')
        );
        expect(token).toBeTruthy();

        // Mobile: open the QR link
        const mobile = await browser.newContext({
            ...devices['Pixel 7'],
            permissions: ['camera'],
        });
        const cameraPage = await mobile.newPage();
        await cameraPage.goto(`/?pair=${token}`);

        // The pairing form is shown first: QR note visible, code entry hidden
        await expect(cameraPage.locator('#camera-pairing')).toBeVisible();
        await expect(cameraPage.locator('#qr-pairing-note')).toBeVisible();
        await expect(cameraPage.locator('#pairing-code-input')).toBeHidden();

        // User names the camera, then connects
        await cameraPage.locator('#camera-name-input').fill('Back Door');
        await cameraPage.locator('#camera-location-input').fill('Warehouse');
        await cameraPage.locator('#pair-camera-btn').click();

        await expect(cameraPage.locator('#camera-connected')).toBeVisible();
        await expect(cameraPage.locator('#camera-display-name')).toHaveText('Back Door');

        // The camera picker opens; confirm the (auto-selected) camera
        const cameraModal = cameraPage.locator('#camera-modal');
        await expect(cameraModal).toHaveClass(/active/);
        await cameraPage.locator('#camera-confirm-btn').click();

        // The video feed must actually start and be laid out on screen
        const video = cameraPage.locator('#video');
        await expect(video).toBeVisible();
        await cameraPage.waitForFunction(
            () => {
                const v = document.getElementById('video');
                return v && v.readyState >= 2 && v.videoWidth > 0;
            },
            null,
            { timeout: 15_000 }
        );
        const box = await video.boundingBox();
        expect(box.height).toBeGreaterThan(100);
        expect(box.width).toBeGreaterThan(100);

        // Setup guide invites drawing the counting line
        await expect(cameraPage.locator('#setup-guide')).toHaveClass(/active/);

        // The control bar carries the primary actions on mobile
        const bar = cameraPage.locator('#camera-control-bar');
        await expect(bar).toBeVisible();
        await expect(cameraPage.locator('#line-mode-bar')).toHaveClass(/active/);

        await cameraPage.locator('#area-mode-bar').click();
        await expect(cameraPage.locator('#area-mode-bar')).toHaveClass(/active/);
        await cameraPage.locator('#line-mode-bar').click();
        await expect(cameraPage.locator('#line-mode-bar')).toHaveClass(/active/);

        // Details open as a slide-over sheet and close via the scrim
        await cameraPage.locator('#camera-details-btn').click();
        await expect(cameraPage.locator('#camera-view')).toHaveClass(/sidebar-open/);
        await expect(cameraPage.locator('#camera-display-name')).toHaveText('Back Door');
        await cameraPage.locator('#camera-sidebar-scrim').click();
        await expect(cameraPage.locator('#camera-view')).not.toHaveClass(/sidebar-open/);

        // Drawing a counting line must not resize or shift the video feed
        await cameraPage.getByRole('button', { name: 'Got it' }).click();
        const before = await video.boundingBox();
        const canvasBox = await cameraPage.locator('#line-canvas').boundingBox();
        const midY = canvasBox.y + canvasBox.height / 2;
        await cameraPage.mouse.move(canvasBox.x + canvasBox.width * 0.3, midY);
        await cameraPage.mouse.down();
        await cameraPage.mouse.move(canvasBox.x + canvasBox.width * 0.7, midY, { steps: 5 });
        await cameraPage.mouse.up();

        const lineCount = await cameraPage.evaluate(
            () => window.countInApp.lineManager.getLines().length
        );
        expect(lineCount).toBe(1);

        const after = await video.boundingBox();
        expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
        await expect(bar).toBeVisible();

        // Hub instantly shows the camera with the user-provided name
        await expect(
            hubPage.locator('#hub-camera-list', { hasText: 'Back Door' })
        ).toBeVisible({ timeout: 15_000 });

        await desktop.close();
        await mobile.close();
    });

    test('expired QR link falls back to manual code entry', async ({ browser }) => {
        const context = await browser.newContext({
            ...devices['Pixel 7'],
            permissions: ['camera'],
        });
        const page = await context.newPage();
        await page.goto('/?pair=this-token-does-not-exist');

        // Manual code entry is offered as the fallback
        await expect(page.locator('#pairing-code-input')).toBeVisible();
        await expect(page.locator('#qr-pairing-note')).toBeHidden();

        await context.close();
    });
});
