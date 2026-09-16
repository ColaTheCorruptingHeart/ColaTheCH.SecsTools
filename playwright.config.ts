import { defineConfig } from '@playwright/test'
import { latestRelease, RELEASE_ACKNOWLEDGEMENT_STORAGE_KEY } from './src/config/releaseNotes'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.pw.ts',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:63897',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:63897',
          localStorage: [
            { name: RELEASE_ACKNOWLEDGEMENT_STORAGE_KEY, value: latestRelease.version }
          ]
        }
      ]
    }
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:63897',
    reuseExistingServer: true,
    timeout: 120_000
  }
})
