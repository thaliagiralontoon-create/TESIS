import { defineConfig,devices } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/e2e",
  fullyParallel:false,
  retries:0,
  // En modo desarrollo cada ruta se compila en su primera visita.
  expect:{timeout:30_000},
  timeout:180_000,
  reporter:"list",
  use:{baseURL:"http://127.0.0.1:3101",trace:"retain-on-failure",...devices["Desktop Chrome"]},
  webServer:{command:"pnpm exec next dev --port 3101",url:"http://127.0.0.1:3101/api/me",reuseExistingServer:false,timeout:120_000,env:{NAKAMA_LOCAL_DB_DIR:".local/e2e",DEV_USER_EMAIL:"e2e.supervisor@nakama.local"}},
});
