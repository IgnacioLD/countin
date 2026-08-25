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
