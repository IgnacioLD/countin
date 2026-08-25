import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 8001;
const FRONTEND_PORT = 5173;
const E2E_DB = '/tmp/countin-e2e.db';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    use: {
        baseURL: `http://localhost:${FRONTEND_PORT}`,
        ...devices['Desktop Chrome'],
        launchOptions: {
            // Auto-grant camera access with a synthetic video feed so camera
            // station pages work without real hardware.
            args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
    },
    webServer: [
        {
            command: `rm -f ${E2E_DB} && cd ../backend && DATABASE_URL=sqlite:///${E2E_DB} ENV=development .venv/bin/alembic upgrade head && DATABASE_URL=sqlite:///${E2E_DB} ENV=development .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
            url: `http://localhost:${BACKEND_PORT}/health`,
            reuseExistingServer: false,
            timeout: 60_000,
        },
        {
            command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
            url: `http://localhost:${FRONTEND_PORT}`,
            reuseExistingServer: false,
            timeout: 60_000,
            env: { VITE_API_URL: `http://localhost:${BACKEND_PORT}` },
        },
    ],
});
