import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const walk = {
  from: [121.04862, 14.55148],
  to: [121.05303, 14.55012],
};

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

  const page = await browser.newPage({ colorScheme: "light" });
  page.on("pageerror", (error) => console.error(error));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
  await page.waitForFunction(() => window.__shadeway?.places?.length, null, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll(".search-field").length >= 2, null, {
    timeout: 60_000,
  });

  const searchToField = await page.evaluate(() => {
    const to = document.querySelectorAll(".search-field")[1];
    const sheet = document.querySelector(".shadeway-sheet");
    if (!to || !sheet) return null;
    const field = to.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    return { fieldBottom: field.bottom, sheetBottom: sheetRect.bottom, fieldTop: field.top, sheetTop: sheetRect.top };
  });
  if (!searchToField || searchToField.fieldBottom > searchToField.sheetBottom + 0.5 || searchToField.fieldTop < searchToField.sheetTop - 0.5) {
    throw new Error(`To field clipped in search sheet: ${JSON.stringify(searchToField)}`);
  }

  const shadowsOff = await page.evaluate(() => window.__shadeway.mapDiagnostics());
  if (!shadowsOff) throw new Error("map diagnostics missing");
  if (shadowsOff.pitch !== 0 || shadowsOff.bearing !== 0) {
    throw new Error(`camera not flat pitch=${shadowsOff.pitch} bearing=${shadowsOff.bearing}`);
  }
  if (shadowsOff.maxPitch !== 0) throw new Error(`maxPitch unlocked: ${shadowsOff.maxPitch}`);
  if (shadowsOff.dragRotateEnabled) throw new Error("dragRotate should be disabled");
  if (shadowsOff.touchRotationEnabled) throw new Error("touch rotation should be disabled");
  for (const id of ["shadows", "shadow-edge", "shadow-edge-estimated"]) {
    if (shadowsOff.layerVisibility[id] !== "none") throw new Error(`shadow layer ${id} expected none, got ${shadowsOff.layerVisibility[id]}`);
  }
  if (shadowsOff.symbolLayerIds.length > 0) {
    throw new Error(`unexpected symbol layers: ${shadowsOff.symbolLayerIds.join(",")}`);
  }

  await page.locator(".shadeway-shadow-toggle").click();
  await page.waitForTimeout(400);
  const shadowsOn = await page.evaluate(() => window.__shadeway.mapDiagnostics());
  if (shadowsOn?.layerVisibility.shadows !== "visible") throw new Error("shadow fill should be visible when toggled on");
  if (shadowsOn?.layerVisibility["shadow-edge-estimated"] !== "visible") {
    throw new Error("estimated shadow edge should be visible when toggled on");
  }
  if (shadowsOn?.layerVisibility["shadow-edge"] !== "none") {
    throw new Error("measured shadow edge should stay hidden when toggled on");
  }
  await page.locator(".shadeway-shadow-toggle").click();
  await page.waitForTimeout(300);

  const fromField = page.locator(".search-field").nth(0);
  await fromField.click();
  const suggestionCount = await page.locator(".suggest__option").count();
  if (suggestionCount < 2) throw new Error(`resting suggestions while editing empty query: ${suggestionCount}`);
  await fromField.pressSequentially("b");
  const stillFocused = await page.evaluate(() => document.activeElement?.matches(".search-field"));
  if (!stillFocused) throw new Error("search field lost focus while typing");

  await page.evaluate((from) => window.__shadeway.pick(from), walk.from);
  await page.waitForTimeout(300);
  await page.evaluate((to) => window.__shadeway.pick(to), walk.to);
  await page.waitForSelector(".route-card__sun", { timeout: 30_000 });
  await page.locator(".departure-chip").click();
  await page.getByRole("option", { name: "12:00" }).click();
  await page.waitForTimeout(800);
  const selected = await page.locator(".route-card[aria-checked='true'] .route-card__title").textContent();
  if (selected !== "Shadiest") throw new Error(`expected Shadiest, got ${selected}`);

  const fastestMeta = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".route-card")];
    const fastest = cards.find((card) => card.textContent?.includes("Fastest"));
    const meta = fastest?.querySelector(".route-card__meta");
    const footer = document.querySelector(".compare-screen__footer");
    if (!meta || !footer) return null;
    return { metaBottom: meta.getBoundingClientRect().bottom, footerTop: footer.getBoundingClientRect().top };
  });
  if (!fastestMeta || fastestMeta.metaBottom > fastestMeta.footerTop + 0.5) {
    throw new Error(`Fastest meta below compare footer fold: ${JSON.stringify(fastestMeta)}`);
  }

  await page.evaluate(() => document.documentElement.style.setProperty("--safe-bottom", "34px"));
  const startInset = await page.evaluate(() => {
    const button = document.querySelector(".compare-screen__footer .primary-action");
    if (!button) return null;
    const bottom = button.getBoundingClientRect().bottom;
    return { bottom, maxBottom: window.innerHeight - 16 - 34 };
  });
  if (!startInset || startInset.bottom > startInset.maxBottom + 0.5) {
    throw new Error(`Start button inside home indicator inset: ${JSON.stringify(startInset)}`);
  }

  await mkdir(resolve(root, "screenshots"), { recursive: true });
  await page.screenshot({ path: resolve(root, "screenshots/compare-phone.png") });
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen");
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(root, "screenshots/in-route-phone.png") });

  const endInset = await page.evaluate(() => {
    const button = document.querySelector(".in-route-screen .primary-action");
    if (!button) return null;
    const bottom = button.getBoundingClientRect().bottom;
    return { bottom, maxBottom: window.innerHeight - 16 - 34 };
  });
  if (!endInset || endInset.bottom > endInset.maxBottom + 0.5) {
    throw new Error(`End button inside home indicator inset: ${JSON.stringify(endInset)}`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__shadeway?.places?.length, null, { timeout: 60_000 });
  const grabberDisplay = await page.evaluate(() => getComputedStyle(document.querySelector(".sheet-grabber")).display);
  if (grabberDisplay !== "none") throw new Error(`desktop grabber display ${grabberDisplay}`);

  await page.evaluate((from) => window.__shadeway.pick(from), walk.from);
  await page.evaluate((to) => window.__shadeway.pick(to), walk.to);
  await page.waitForSelector(".route-card__sun", { timeout: 30_000 });
  await page.locator(".departure-chip").click();
  await page.getByRole("option", { name: "12:00" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(root, "screenshots/compare-desktop.png") });
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen");
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(root, "screenshots/in-route-desktop.png") });

  const weight = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const navigation = performance.getEntriesByType("navigation")[0];
    const resourceBytes = resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    const navigationBytes = navigation?.transferSize || 0;
    return {
      navigationBytes,
      resourceBytes,
      totalBytes: navigationBytes + resourceBytes,
    };
  });
  console.log(JSON.stringify({ weight, grabberDisplay, suggestionCount }, null, 2));
  await browser.close();
} finally {
  server.kill("SIGTERM");
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
