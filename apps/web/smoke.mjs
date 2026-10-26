import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

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
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
  });
  page.on("pageerror", (error) => {
    console.error(error);
  });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.route === "ready", null, { timeout: 30_000 });
  await page.click(".sheet-grabber");
  await page.getByRole("button", { name: "Bonifacio High Street" }).click();
  await page.waitForSelector(".compare-screen");
  await page.locator(".time-scrubber__slider").fill("18");
  await page.locator(".sheet-body").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.waitForTimeout(800);
  await mkdir(resolve(root, "screenshots"), { recursive: true });
  await page.screenshot({ path: resolve(root, "screenshots/3d-compare.png") });
  await page.getByRole("button", { name: "2D" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(root, "screenshots/2d-compare.png") });
  await page.getByRole("button", { name: "3D" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen, .sheet-body");
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(root, "screenshots/in-route.png") });
  const weight = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const navigation = performance.getEntriesByType("navigation")[0];
    const resourceBytes = resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    const navigationBytes = navigation?.transferSize || 0;
    return {
      navigationBytes,
      resourceBytes,
      totalBytes: navigationBytes + resourceBytes,
      files: resources.map((entry) => ({ name: entry.name, bytes: entry.transferSize || 0 })),
    };
  });
  console.log(JSON.stringify(weight, null, 2));
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
