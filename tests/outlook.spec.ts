import { test, expect } from "@playwright/test";
test("2026 opens with all three phases and no invented actuals", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator(".context-bar")).toContainText("2026 ESTIMATE");
  await expect(
    page.getByRole("heading", { name: "Diwali 2026 air quality" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Before Diwali Two days before" })
    .click();
  await expect(page.locator(".context-bar")).toContainText("Before Diwali");
  await page
    .getByRole("button", { name: "Diwali night Diwali evening" })
    .click();
  await expect(page.locator(".context-bar")).toContainText("Burst");
  await expect(
    page.getByRole("button", { name: "Recorded", exact: true }),
  ).toBeDisabled();
  const response = await request.get("/api/v1/replay?snapshot=2026-during");
  expect(response.ok()).toBe(true);
  const snapshot = await response.json();
  expect(snapshot.kind).toBe("outlook");
  expect(snapshot.stations.length).toBeGreaterThanOrEqual(30);
  for (const station of snapshot.stations) {
    expect(station.points).toHaveLength(72);
    expect(station.outlook.minimumHourlySamples).toBeGreaterThanOrEqual(3);
    expect(station.outlook.sourceYears.every((y: number) => y < 2026)).toBe(
      true,
    );
    for (const p of station.points) {
      expect(p.actual).toBeNull();
      expect(p.p10).toBeLessThanOrEqual(p.p50);
      expect(p.p50).toBeLessThanOrEqual(p.p90);
      expect(p.time).toMatch(/^2026-11-/);
    }
  }
  const scenario = await request.post("/api/v1/scenario", {
    data: {
      snapshot: "2026-during",
      station: "site_301",
      traffic: -20,
      wind: 1.5,
    },
  });
  expect(scenario.status()).toBe(409);
});
test("2026 evidence and grounded assistant use analog method", async ({
  page,
  request,
}) => {
  await page.goto("/why");
  await expect(
    page.getByRole("heading", {
      name: /The past has a pattern/,
    }),
  ).toBeVisible();
  await expect(page.locator(".contribution-bars")).toHaveCount(0);
  await page.goto("/report-card");
  await expect(
    page.getByRole("heading", { name: "Checks for the 2026 method" }),
  ).toBeVisible();
  const answer = await request.post("/api/v1/assistant", {
    data: {
      snapshot: "2026-during",
      station: "site_301",
      question: "What happens on Diwali?",
    },
  });
  expect(answer.ok()).toBe(true);
  expect((await answer.json()).answer).toContain("past Diwalis");
});
