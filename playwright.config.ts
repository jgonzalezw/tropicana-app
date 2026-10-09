import { defineConfig, devices } from "@playwright/test";

// Las pruebas de punta a punta corren contra DEV (nunca producción). Las
// credenciales vienen de `.env.local` (QA_CLOUD_PASSWORD) o de variables
// E2E_EMAIL / E2E_PASSWORD; no se guardan en el repo.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: las pruebas que necesitan sesión se saltan y lo dicen.
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // la prueba «interruptor apagado» cambia un dato: corre sola y al final
  reporter: "list",
  // El servidor de dev compila cada ruta la primera vez que se pide.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "setup", testMatch: /login\.setup\.ts/ },
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/qa.json" },
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
