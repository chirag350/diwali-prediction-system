import { test, expect } from "@playwright/test";
test("every sidebar link changes the visible page", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto("/");
  const paths = [
    "map",
    "my-air",
    "time-machine",
    "why",
    "lab",
    "compare",
    "authority",
    "report-card",
    "report",
    "about",
    "status",
  ];
  for (const id of paths) {
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "Open navigation" }).click();
    await page.locator(`.sidebar:visible a.nav-link[href^="/${id}?"]`).click();
    await expect(page).toHaveURL(new RegExp("/" + id + "\\?"));
    await expect(page.locator("main:visible h1")).not.toHaveText(
      "Delhi-NCR air quality",
    );
    await expect(
      page.locator(`.sidebar:visible a.nav-link[href^="/${id}?"]`),
    ).toHaveClass(/active/);
  }
});

test("unknown routes never silently show the cached home page", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const cache = await caches.open("shwasa-v1");
    await cache.put(
      "/",
      new Response("<h1>The air, a little ahead.</h1>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
  });
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Delhi-NCR air quality" }),
  ).toHaveCount(0);
});
