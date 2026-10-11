import { defineConfig } from "@playwright/test";

// Fluxos E2E. Os testes de páginas públicas rodam sem banco; os autenticados exigem E2E_EMAIL/E2E_PASSWORD
// de um usuário de teste num projeto Supabase de homologação.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", launchOptions: { executablePath: process.env.CHROMIUM_PATH } },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run build && npm start", port: 3000, timeout: 240_000, reuseExistingServer: true },
});
