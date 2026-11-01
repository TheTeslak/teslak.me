import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/mobile',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:1112',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: 'pnpm photos && pnpm exec vite --host 127.0.0.1 --port 1112 --strictPort',
    url: 'http://127.0.0.1:1112',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
