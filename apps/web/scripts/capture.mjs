import { spawn } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const walks = [
  {
    id: "high-street-covered",
    from: [121.0476, 14.55152],
    to: [121.04606, 14.55202],
  },
  {
    id: "high-street-trees",
    from: [121.04862, 14.55148],
    to: [121.05303, 14.55012],
  },
  {
    id: "uptown-footbridge",
    from: [121.0541499, 14.5569653],
    to: [121.0543932, 14.55879],
  },
];

const shotWalk = walks[1];
const port = 5173;
const server = spawn("pnpm", ["exec", "vite", "--port", String(port), "--host", "127.0.0.1", "--strictPort"], {
  cwd: root,
  stdio: "inherit",
});

try {
  await waitFor(`http://127.0.0.1:${port}`);
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const outDir = resolve(root, "screenshots");
  await mkdir(outDir, { recursive: true });
  await rm(resolve(outDir, "compare.png"), { force: true });
  await rm(resolve(outDir, "in-route.png"), { force: true });
  const artifacts = "/opt/cursor/artifacts";
  await mkdir(artifacts, { recursive: true });

  if (process.env.SHOTS_ONLY !== "1") {
  const measure = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const measurePage = await measure.newPage();
  const transferred = [];
  measurePage.on("response", (response) => {
    const length = Number(response.headers()["content-length"]);
    transferred.push({
      url: response.url(),
      status: response.status(),
      contentLength: Number.isFinite(length) ? length : null,
    });
  });
  await measurePage.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await measurePage.waitForFunction(() => window.__shadeway?.places, null, { timeout: 60_000 });
  const weight = await measurePage.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const navigation = performance.getEntriesByType("navigation")[0];
    const files = resources.map((entry) => ({
      name: entry.name,
      transfer: entry.transferSize || 0,
      encoded: entry.encodedBodySize || 0,
      decoded: entry.decodedBodySize || 0,
    }));
    const resourceTransfer = files.reduce((sum, file) => sum + file.transfer, 0);
    const navigationTransfer = navigation?.transferSize || 0;
    return {
      navigationTransfer,
      resourceTransfer,
      totalTransfer: navigationTransfer + resourceTransfer,
      files: files.sort((a, b) => b.transfer - a.transfer).slice(0, 12),
    };
  });
  const routes = await measurePage.evaluate(async (input) => {
    const summary = [];
    for (const walk of input) {
      const result = await window.__shadeway.route(walk.from, walk.to, 12 * 60);
      const weights = ["fastest", "balanced", "shadiest"];
      summary.push({
        id: walk.id,
        routes: Object.fromEntries(
          weights.map((weight) => {
            const route = result[weight];
            return [
              weight,
              route
                ? {
                    minutes: Math.round(route.durationS / 60),
                    sunMinutes: Math.round(route.sunSeconds / 60),
                    distanceM: Math.round(route.distanceM),
                    edges: route.edgeIds.length,
                  }
                : null,
            ];
          }),
        ),
      });
    }
    return summary;
  }, walks);

  const client = await measure.newCDPSession(measurePage);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const samples = await measurePage.evaluate(async (input) => {
    const rows = [];
    for (const walk of input) {
      await window.__shadeway.route(walk.from, walk.to, 12 * 60);
      const runs = [];
      for (let i = 0; i < 20; i += 1) {
        const started = performance.now();
        await window.__shadeway.route(walk.from, walk.to, 12 * 60);
        runs.push(performance.now() - started);
      }
      runs.sort((a, b) => a - b);
      rows.push({ id: walk.id, runs, p95: runs[18] });
    }
    return rows;
  }, walks);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  console.log(JSON.stringify({ weight, routes, samples, transferred: transferred.length }, null, 2));
  await measure.close();
  }
  if (process.env.SHOTS_ONLY !== "1") {
    await exercise(browser);
  }

  for (const size of [
    { name: "phone", width: 390, height: 844, deviceScaleFactor: 2 },
    { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
  ]) {
    await shoot(browser, size, "light", artifacts);
  }
  await shoot(browser, { name: "phone", width: 390, height: 844, deviceScaleFactor: 2 }, "dark", artifacts);
  await shoot(browser, { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 }, "dark", artifacts);
  await browser.close();
} finally {
  server.kill("SIGTERM");
}

async function shoot(browser, size, scheme, artifactsDir) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.deviceScaleFactor,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error(error));
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
  await page.waitForFunction(() => window.__shadeway?.places?.length, null, { timeout: 60_000 });
  const suffix = scheme === "dark" ? "-dark" : "";
  const searchPath = resolve(root, "screenshots", `${size.name}-search${suffix}.png`);
  await page.screenshot({ path: searchPath });
  if (scheme === "light") await copyFile(searchPath, resolve(artifactsDir, `${size.name}-search.png`));
  await page.evaluate((from) => window.__shadeway.pick(from), shotWalk.from);
  await page.evaluate((to) => window.__shadeway.pick(to), shotWalk.to);
  await page.waitForSelector(".route-card__sun", { timeout: 30_000 });
  await setSlot(page, "12", "12:00");
  const comparePath = resolve(root, "screenshots", `${size.name}-compare${suffix}.png`);
  await page.screenshot({ path: comparePath });
  if (scheme === "light") {
    await copyFile(comparePath, resolve(artifactsDir, `${size.name}-compare.png`));
  }
  if (scheme === "dark") {
    await copyFile(comparePath, resolve(artifactsDir, `${size.name}-compare-dark.png`));
  }
  if (scheme === "light") {
    await page.locator(".shadeway-shadow-toggle").click();
    await page.waitForTimeout(500);
    const compareShadowsPath = resolve(root, "screenshots", `${size.name}-compare-shadows-on.png`);
    await page.screenshot({ path: compareShadowsPath });
    await copyFile(compareShadowsPath, resolve(artifactsDir, `${size.name}-compare-shadows-on.png`));
  }
  if (scheme === "light") {
    await setSlot(page, "6", "09:00");
    await page.screenshot({ path: resolve(root, "screenshots", `${size.name}-compare-0900.png`) });
    await setSlot(page, "18", "15:00");
    await page.screenshot({ path: resolve(root, "screenshots", `${size.name}-compare-1500.png`) });
  }
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen");
  await page.waitForTimeout(800);
  const inRoutePath = resolve(root, "screenshots", `${size.name}-in-route${suffix}.png`);
  await page.screenshot({ path: inRoutePath });
  if (scheme === "light") await copyFile(inRoutePath, resolve(artifactsDir, `${size.name}-in-route.png`));
  const text = await page.locator(".route-card, .in-route-screen").allTextContents();
  console.log(size.name, text.join(" | "));
  await context.close();
}

async function exercise(browser) {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await phone.newPage();
  page.on("pageerror", (error) => console.error(error));
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__shadeway?.places?.length, null, { timeout: 60_000 });
  const phoneSheet = await page.locator(".shadeway-sheet").boundingBox();
  if (!phoneSheet || phoneSheet.width < 370) throw new Error(`phone sheet width ${phoneSheet?.width}`);
  const fromField = page.locator(".search-field").nth(0);
  const toField = page.locator(".search-field").nth(1);
  await fromField.fill("boni");
  await page.waitForSelector(".suggest__option");
  const suggestion = await page.locator(".suggest__option").first().innerText();
  if (suggestion !== "Bonifacio High Street") throw new Error(`search rank ${suggestion}`);
  await page.locator(".suggest__option").first().click();
  await toField.fill("market");
  await page.waitForSelector(".suggest__option");
  await page.locator(".suggest__option").first().click();
  await page.waitForSelector(".route-card__sun", { timeout: 30_000 });
  await setSlot(page, "6", "09:00");
  const titles = await page.locator(".route-card__title").allTextContents();
  if (titles.join(",") !== "Shadiest,Fastest") throw new Error(`card order ${titles.join(",")}`);
  const labelCount = await page.locator(".sheet-estimate-label").count();
  if (labelCount !== 1) throw new Error(`estimate labels ${labelCount}`);
  const at9 = await page.locator(".route-card__sun").allTextContents();
  await setSlot(page, "18", "15:00");
  const at15 = await page.locator(".route-card__sun").allTextContents();
  if (at9.join("|") === at15.join("|")) throw new Error(`sun minutes did not change ${at9.join("|")}`);
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen");
  await page.getByRole("button", { name: "End" }).click();
  await page.waitForSelector(".route-card__sun");
  await page.evaluate(() => window.__shadeway.pick([121.0, 14.5]));
  await page.waitForFunction(() => document.body.innerText.includes("Outside the pilot area"));
  await phone.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const wide = await desktop.newPage();
  await wide.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await wide.waitForSelector(".shadeway-sheet");
  const wideSheet = await wide.locator(".shadeway-sheet").boundingBox();
  if (!wideSheet || wideSheet.width < 370 || wideSheet.width > 400) {
    throw new Error(`desktop sheet ${wideSheet?.width}x${wideSheet?.height}`);
  }
  await desktop.close();
  console.log(JSON.stringify({ phoneSheet, wideSheet, titles, at9, at15 }));
}

async function setSlot(page, _value, label) {
  await page.locator(".departure-chip").click();
  await page.getByRole("option", { name: label }).click();
  await page.waitForTimeout(700);
}

async function waitFor(url) {
  const started = Date.now();
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Server is still booting.
    }
    if (Date.now() - started > 20_000) throw new Error(`dev server did not start: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
