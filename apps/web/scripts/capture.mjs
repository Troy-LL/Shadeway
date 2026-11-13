import { execSync, spawn } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(root);
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
const COPY_MARKER_SHADIEST_AND_FASTEST = "Shadiest and fastest";
const port = Number(process.env.CAPTURE_PORT ?? 5193);
const outputRoot = process.env.CAPTURE_OUT ? resolve(process.env.CAPTURE_OUT) : resolve(root, "screenshots");
const artifactRoot = process.env.CAPTURE_ARTIFACTS ? resolve(process.env.CAPTURE_ARTIFACTS) : outputRoot;

const buildSha = execSync("git rev-parse HEAD", { cwd: workspaceRoot, encoding: "utf8" }).trim();
execSync("pnpm --filter @shadeway/web build", {
  cwd: workspaceRoot,
  stdio: "inherit",
  env: { ...process.env, VITE_CAPTURE: "1" },
});
await writeFile(resolve(root, "dist", "build-sha.txt"), `${buildSha}\n`, "utf8");

const server = spawn(
  "pnpm",
  ["exec", "vite", "preview", "--port", String(port), "--host", "127.0.0.1", "--strictPort"],
  {
    cwd: root,
    stdio: "inherit",
  },
);

try {
  await waitFor(`http://127.0.0.1:${port}`);
  await assertBuildSha(port, buildSha);
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  await mkdir(outputRoot, { recursive: true });
  if (artifactRoot !== outputRoot) await mkdir(artifactRoot, { recursive: true });
  await rm(resolve(outputRoot, "compare.png"), { force: true });
  await rm(resolve(outputRoot, "in-route.png"), { force: true });

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
    const samples = [];
    for (const walk of walks) {
      await measurePage.evaluate(
        async ({ from, to }) => {
          await window.__shadeway.route(from, to, 12 * 60);
        },
        walk,
      );
      const runs = [];
      for (let index = 0; index < 20; index += 1) {
        await client.send("Emulation.setCPUThrottlingRate", { rate: index === 0 ? 20 : 1 });
        const started = performance.now();
        await measurePage.evaluate(
          async ({ from, to }) => {
            await window.__shadeway.route(from, to, 12 * 60);
          },
          walk,
        );
        const ended = performance.now();
        runs.push(ended - started);
      }
      runs.sort((a, b) => a - b);
      samples.push({ id: walk.id, runs, p95: runs[18] });
    }
    console.log(JSON.stringify({ weight, routes, samples, transferred: transferred.length }, null, 2));
    await measure.close();
    await exercise(browser);
  }

  for (const size of [
    { name: "phone", width: 390, height: 844, deviceScaleFactor: 2 },
    { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
  ]) {
    await shoot(browser, size, "light", outputRoot, artifactRoot);
  }
  await shoot(browser, { name: "phone", width: 390, height: 844, deviceScaleFactor: 2 }, "dark", outputRoot, artifactRoot);
  await shoot(browser, { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 }, "dark", outputRoot, artifactRoot);
  await shootSafeArea(browser, outputRoot, artifactRoot);
  await shootOutsideHours(browser, outputRoot, artifactRoot);
  await browser.close();
} finally {
  server.kill("SIGTERM");
}

async function shoot(browser, size, scheme, outputDir, artifactsDir) {
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
  const searchPath = resolve(outputDir, `${size.name}-search${suffix}.png`);
  await page.screenshot({ path: searchPath });
  await mirror(searchPath, artifactsDir, `${size.name}-search${suffix}.png`);
  if (size.name === "phone" && scheme === "light") {
    await page.locator(".search-field").nth(1).click();
    await page.waitForTimeout(200);
    const focusedPath = resolve(outputDir, "phone-search-focused.png");
    await page.screenshot({ path: focusedPath });
    await mirror(focusedPath, artifactsDir, "phone-search-focused.png");
  }
  await page.evaluate((from) => window.__shadeway.pick(from), shotWalk.from);
  await page.evaluate((to) => window.__shadeway.pick(to), shotWalk.to);
  await page.waitForSelector(".route-card__sun", { timeout: 30_000 });
  await setSlot(page, "12", "12:00");
  const selected = await page.locator(".route-card[aria-checked='true'] .route-card__title").textContent();
  if (!selected?.includes("Shadiest")) throw new Error(`expected Shadiest selected at 12:00, got ${selected}`);
  const comparePath = resolve(outputDir, `${size.name}-compare${suffix}.png`);
  await page.screenshot({ path: comparePath });
  await mirror(comparePath, artifactsDir, `${size.name}-compare${suffix}.png`);
  if (scheme === "light") {
    await page.locator(".shadeway-shadow-toggle").click();
    await page.waitForTimeout(500);
    const compareShadowsPath = resolve(outputDir, `${size.name}-compare-shadows-on.png`);
    await page.screenshot({ path: compareShadowsPath });
    await mirror(compareShadowsPath, artifactsDir, `${size.name}-compare-shadows-on.png`);
  }
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen");
  await page.waitForTimeout(800);
  const inRoutePath = resolve(outputDir, `${size.name}-in-route${suffix}.png`);
  await page.screenshot({ path: inRoutePath });
  await mirror(inRoutePath, artifactsDir, `${size.name}-in-route${suffix}.png`);
  const text = await page.locator(".route-card, .in-route-screen").allTextContents();
  console.log(size.name, text.join(" | "));
  await context.close();
}

async function shootSafeArea(browser, outputDir, artifactsDir) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__shadeway?.places?.length, null, { timeout: 60_000 });
  await page.evaluate(() => document.documentElement.style.setProperty("--safe-bottom", "34px"));
  await page.evaluate((from) => window.__shadeway.pick(from), shotWalk.from);
  await page.evaluate((to) => window.__shadeway.pick(to), shotWalk.to);
  await page.waitForSelector(".compare-screen", { timeout: 30_000 });
  await setSlot(page, "12", "12:00");
  const comparePath = resolve(outputDir, "phone-compare-safe-34.png");
  await page.screenshot({ path: comparePath });
  await mirror(comparePath, artifactsDir, "phone-compare-safe-34.png");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen");
  await page.waitForTimeout(500);
  const inRoutePath = resolve(outputDir, "phone-in-route-safe-34.png");
  await page.screenshot({ path: inRoutePath });
  await mirror(inRoutePath, artifactsDir, "phone-in-route-safe-34.png");
  await context.close();
}

async function shootOutsideHours(browser, outputDir, artifactsDir) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(() => {
    const fixed = new Date("2026-10-26T22:00:00+08:00");
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixed);
          return;
        }
        super(...args);
      }
      static now() {
        return fixed.getTime();
      }
    }
    globalThis.Date = MockDate;
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__shadeway?.places?.length, null, { timeout: 60_000 });
  await page.evaluate((from) => window.__shadeway.pick(from), shotWalk.from);
  await page.evaluate((to) => window.__shadeway.pick(to), shotWalk.to);
  await page.waitForSelector(".compare-screen", { timeout: 30_000 });
  const meta = await page.locator(".route-card__meta").allTextContents();
  if (meta.some((line) => line.includes(COPY_MARKER_SHADIEST_AND_FASTEST))) {
    throw new Error(`outside-hours compare should not show merged title: ${meta.join("|")}`);
  }
  if (!meta.every((line) => line.includes("Fastest walk"))) {
    throw new Error(`outside-hours route cards should use Fastest walk: ${meta.join("|")}`);
  }
  if (meta.some((line) => line.includes("Shadiest"))) {
    throw new Error(`outside-hours compare must not claim Shadiest: ${meta.join("|")}`);
  }
  const path = resolve(outputDir, "phone-compare-outside-hours.png");
  await page.screenshot({ path });
  await mirror(path, artifactsDir, "phone-compare-outside-hours.png");
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
  const resting = await page.locator(".suggest__option").count();
  if (resting < 2) throw new Error(`resting suggestions ${resting}`);
  await page.evaluate((from) => window.__shadeway.pick(from), shotWalk.from);
  await page.evaluate((to) => window.__shadeway.pick(to), shotWalk.to);
  await page.waitForSelector(".route-card__sun", { timeout: 30_000 });
  await setSlot(page, "12", "12:00");
  const metaLines = await page.locator(".route-card__meta").allTextContents();
  if (!metaLines[0]?.startsWith("Shadiest") || !metaLines[1]?.startsWith("Fastest")) {
    throw new Error(`card order ${metaLines.join("|")}`);
  }
  const selected = await page.locator(".route-card[aria-checked='true'] .route-card__title").textContent();
  if (selected !== "Shadiest") throw new Error(`selected route ${selected}`);
  const labelCount = await page.locator(".sheet-estimate-label").count();
  if (labelCount !== 1) throw new Error(`estimate labels ${labelCount}`);
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen");
  const inRouteStatus = await page.locator(".in-route-screen__status").textContent();
  if (!inRouteStatus?.includes("Leave 12:00")) throw new Error(`in-route time ${inRouteStatus}`);
  await page.getByRole("button", { name: "End" }).click();
  await page.waitForSelector(".route-card__sun");
  await phone.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const wide = await desktop.newPage();
  await wide.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await wide.waitForSelector(".shadeway-sheet");
  const wideSheet = await wide.locator(".shadeway-sheet").boundingBox();
  if (!wideSheet || wideSheet.width < 370 || wideSheet.width > 400) {
    throw new Error(`desktop sheet ${wideSheet?.width}x${wideSheet?.height}`);
  }
  if (wideSheet.height > 700) throw new Error(`desktop panel stretched ${wideSheet.height}`);
  await desktop.close();
  console.log(JSON.stringify({ phoneSheet, wideSheet, titles, inRouteStatus }));
}

async function setSlot(page, _value, label) {
  await page.locator(".departure-chip").click();
  await page.getByRole("option", { name: label }).click();
  await page.waitForTimeout(700);
}

async function mirror(from, artifactsDir, name) {
  const dest = resolve(artifactsDir, name);
  if (resolve(from) === dest) return;
  await copyFile(from, dest);
}

async function assertBuildSha(port, expected) {
  const response = await fetch(`http://127.0.0.1:${port}/build-sha.txt`);
  if (!response.ok) throw new Error(`build-sha.txt missing: ${response.status}`);
  const served = (await response.text()).trim();
  if (served !== expected) {
    throw new Error(`stale preview build ${served} (expected ${expected})`);
  }
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
