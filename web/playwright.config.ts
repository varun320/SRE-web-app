import { defineConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
