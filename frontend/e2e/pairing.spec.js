import { test, expect, devices } from '@playwright/test';

test.describe('mobile camera station pairing with hub', () => {
    test('hub shows pairing code, mobile pairs with it and appears in the hub', async ({
        browser,
    }) => {
        // Desktop: create a hub dashboard
        const desktop = await browser.newContext();
        const hubPage = await desktop.newPage();
        await hubPage.goto('/');
        await hubPage.getByRole('button', { name: /Hub Dashboard/ }).click();

        const hubView = hubPage.locator('#hub-view');
        await expect(hubView).toBeVisible();

        // Reveal the pairing code
        await hubPage.locator('#toggle-code-btn').click();
        const code = await hubPage.locator('#hub-pairing-code').textContent();
        expect(code).toMatch(/^[A-Z0-9]{6}$/);

        // Mobile: pair as a camera station using the code
        const mobile = await browser.newContext({
            ...devices['Pixel 7'],
            permissions: ['camera'],
        });
        const cameraPage = await mobile.newPage();
        await cameraPage.goto('/');
        await cameraPage.getByRole('button', { name: /Camera Station/ }).click();

        await cameraPage.locator('#pairing-code-input').fill(code);
        await cameraPage.locator('#camera-name-input').fill('Front Gate');
        await cameraPage.locator('#pair-camera-btn').click();

        const connected = cameraPage.locator('#camera-connected');
        await expect(connected).toBeVisible();
        await expect(cameraPage.locator('#camera-display-name')).toHaveText('Front Gate');

        // Hub sees the camera (polling) and counts it online
        const cameraCard = hubPage.locator('#hub-camera-list', {
            hasText: 'Front Gate',
        });
        await expect(cameraCard).toBeVisible({ timeout: 15_000 });
        await expect(hubPage.locator('#hub-cameras-connected')).toHaveText('1', {
            timeout: 15_000,
        });

        // Simulate crossings from the mobile side; the hub must reflect them
        // in real time via the WebSocket relay (not the 5s poll)
        await cameraPage.evaluate(() => {
            const app = window.countInApp;
            app.counts.in += 2;
            app.sendCountUpdate('in');
        });
        await expect(hubPage.locator('#hub-total-in')).toHaveText('2', { timeout: 3_000 });

        await cameraPage.evaluate(() => {
            const app = window.countInApp;
            app.counts.out += 1;
            app.sendCountUpdate('out');
        });
        await expect(hubPage.locator('#hub-total-out')).toHaveText('1', { timeout: 3_000 });

        // A dropped connection (mobile network blip) must self-heal
        const connectionStatus = cameraPage.locator('#camera-connected .connection-status');
        await cameraPage.evaluate(() => window.countInApp.cameraWebSocket.close());
        await expect(connectionStatus).toHaveClass(/(^|\s)disconnected($|\s)/, {
            timeout: 5_000,
        });
        await expect(connectionStatus).toHaveClass(/(^|\s)connected($|\s)/, {
            timeout: 15_000,
        });
        // And the hub sees the camera online again
        await expect(
            hubPage.locator('.camera-card .camera-status.online')
        ).toBeVisible({ timeout: 15_000 });

        await desktop.close();
        await mobile.close();
    });

    test('hub deletes the camera; the phone returns to the pairing screen', async ({
        browser,
    }) => {
        const desktop = await browser.newContext();
        const hubPage = await desktop.newPage();
        await hubPage.goto('/');
        await hubPage.getByRole('button', { name: /Hub Dashboard/ }).click();
        await expect(hubPage.locator('#hub-view')).toBeVisible();

        const code = await hubPage.evaluate(() => {
            document.getElementById('toggle-code-btn').click();
            return document.getElementById('hub-pairing-code').textContent;
        });

        const mobile = await browser.newContext({
            ...devices['Pixel 7'],
            permissions: ['camera'],
        });
        const cameraPage = await mobile.newPage();
        await cameraPage.goto('/');
        await cameraPage.getByRole('button', { name: /Camera Station/ }).click();
        await cameraPage.locator('#pairing-code-input').fill(code);
        await cameraPage.locator('#camera-name-input').fill('Temp Cam');
        await cameraPage.locator('#pair-camera-btn').click();
        await expect(cameraPage.locator('#camera-connected')).toBeVisible();

        // Hub removes the camera
        hubPage.on('dialog', (dialog) => dialog.accept());
        await hubPage
            .locator('.camera-card', { hasText: 'Temp Cam' })
            .getByRole('button', { name: 'Delete' })
            .click();

        // The phone is kicked back to the pairing screen and the hub list
        // no longer shows the camera
        await expect(cameraPage.locator('#camera-pairing')).toBeVisible({
            timeout: 15_000,
        });
        await expect(
            hubPage.locator('#hub-camera-list .empty-state')
        ).toBeVisible({ timeout: 15_000 });

        await desktop.close();
        await mobile.close();
    });
});
