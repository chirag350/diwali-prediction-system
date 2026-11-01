import { test, expect } from "@playwright/test";
test("overview renders real candidate forecasts and supports neighborhood search", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?snapshot=2025-during");
  await expect(
    page.getByRole("heading", { name: "Delhi-NCR air quality" }),
  ).toBeVisible();
  await expect(page.locator(".big-number")).toContainText("/ 500");
  await expect(page.locator(".big-number")).toContainText("404");
  await page
    .locator(".air-source-toggle")
    .getByRole("button", { name: "Estimated", exact: true })
    .click();
  await expect(page.locator(".big-number")).toContainText("405");
  await page
    .locator(".air-metric-toggle")
    .getByRole("button", { name: "PM2.5", exact: true })
    .click();
  await expect(page.locator(".big-number")).toContainText("µg/m³");
  await expect(page.locator(".context-bar")).toContainText("PAST YEAR");
  await page.locator(".place-picker").click();
  await page.getByPlaceholder("Search for an area").fill("Punjabi");
  await page.locator(".command-results button").first().click();
  await expect(page.locator(".air-card>h2")).toContainText("Punjabi");
  const range = page.getByRole("slider", { name: "Hour shown" });
  await range.focus();
  await range.press("End");
  await expect(range).toHaveValue("71");
  await range.press("Home");
  await expect(range).toHaveValue("0");
  await expect(page.locator(".map-loading")).toHaveCount(0);
  await page.screenshot({
    path: `/tmp/shwasa-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
test("replay, report card, explanation and scenarios work", async ({
  page,
}) => {
  await page.goto("/time-machine?snapshot=2025-during");
  await page
    .getByRole("button", { name: "Before Diwali Two days before" })
    .click();
  await expect(page.locator(".context-bar")).toContainText("Before Diwali");
  await expect(page.locator(".loading-bar")).toHaveCount(0);
  await page.getByRole("button", { name: "Recorded", exact: true }).click();
  await page.goto("/report-card");
  await expect(
    page.getByRole("heading", { name: "Errors by forecast time" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".table-card")
      .filter({
        has: page.getByRole("heading", { name: "Errors by forecast time" }),
      })
      .locator("tbody tr"),
  ).toHaveCount(4);
  await expect(page.locator(".metric-card").first()).toContainText("20.26");
  await page.goto("/why?snapshot=2025-during");
  await expect(page.locator(".contribution-row")).toHaveCount(6);
  await expect(page.locator(".contribution-sum")).not.toContainText("NaN");
  await page.goto("/lab?snapshot=2025-during");
  await expect(
    page.getByRole("heading", { name: "Change the settings" }),
  ).toBeVisible();
  const wind = page.getByRole("slider", { name: "Wind speed multiplier" });
  if (await wind.isEnabled()) {
    await wind.focus();
    await wind.press("End");
    await expect(wind).toHaveValue("2");
  }
  await expect(page.locator(".scenario-stats")).not.toContainText("NaN");
});
test("forecast APIs validate inputs and preserve interval and attribution contracts", async ({
  request,
}) => {
  const f = await request.get(
    "/api/v1/forecast?snapshot=2025-during&station=site_301",
  );
  expect(f.ok()).toBe(true);
  const d = await f.json();
  expect(d.station.points).toHaveLength(72);
  for (const p of d.station.points) {
    expect(p.p10).toBeGreaterThanOrEqual(0);
    expect(p.p50).toBeGreaterThanOrEqual(p.p10);
    expect(p.p90).toBeGreaterThanOrEqual(p.p50);
  }
  const r = await request.get(
    "/api/v1/attribution?snapshot=2025-during&station=site_301&hour=24",
  );
  const a = await r.json();
  expect(
    Object.values(a.groups).reduce((s: number, v) => s + Number(v), 0) +
      a.clippingAdjustment,
  ).toBeCloseTo(a.p50, 5);
  expect((await request.get("/api/v1/attribution?hour=73")).status()).toBe(400);
  expect((await request.get("/api/v1/forecast?station=missing")).status()).toBe(
    404,
  );
  expect(
    (
      await request.post("/api/v1/scenario", {
        data: {
          station: "site_301",
          snapshot: "2025-during",
          traffic: 999,
          wind: 1,
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/v1/reports", {
        data: { h3: "invalid", kind: "haze" },
      })
    ).status(),
  ).toBe(400);
  const scenario = await request.post("/api/v1/scenario", {
    data: {
      station: "site_301",
      snapshot: "2025-during",
      traffic: -20,
      wind: 1.5,
    },
  });
  expect(scenario.ok()).toBe(true);
  expect((await scenario.json()).points).toHaveLength(72);
});
test("all major routes render and mobile navigation stays usable", async ({
  page,
}, testInfo) => {
  for (const route of [
    "/my-air",
    "/compare",
    "/authority",
    "/report",
    "/about",
    "/status",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Air map" }).click();
    await expect(page.locator(".sidebar:visible")).not.toHaveClass(
      /sidebar-open/,
    );
  }
});

test("shared URLs retain archived hour and widget loads without navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?snapshot=2023-before&station=site_301&hour=24");
  await expect(page.locator(".context-bar")).toContainText("Diwali 2023");
  await expect(page.getByRole("slider", { name: "Hour shown" })).toHaveValue(
    "24",
  );
  await expect(page).toHaveURL(/snapshot=2023-before/);
  await page.getByRole("button", { name: "Use night theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/embed?station=site_301");
  await expect(page.locator(".widget-shell h1")).toContainText("Anand");
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.locator(".widget-number")).toContainText("/ 500");
  expect(errors).toEqual([]);
});
