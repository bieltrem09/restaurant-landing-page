import { expect, test } from "@playwright/test";

test("rotas privadas redirecionam para o login", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("sem rolagem lateral em 375px, nos dois temas", async ({ browser }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, colorScheme });
    for (const path of ["/login", "/privacidade"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    }
    await page.close();
  }
});

test("script de rastreamento é servido com CORS", async ({ request }) => {
  const r = await request.get("/t.js");
  expect(r.ok()).toBeTruthy();
  expect(r.headers()["access-control-allow-origin"]).toBe("*");
  expect(await r.text()).toContain("sendBeacon");
});

test("evento de rastreamento inválido é rejeitado", async ({ request }) => {
  const r = await request.post("/api/track", { data: "{}" });
  expect(r.status()).toBe(400);
});
