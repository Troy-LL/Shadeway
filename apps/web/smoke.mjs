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
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
  });
  page.on("pageerror", (error) => {
    console.error(error);
  });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
  await page.waitForFunction(() => window.__shadeway?.places?.length, null, { timeout: 60_000 });
  await page.evaluate((from) => window.__shadeway.pick(from), walk.from);
  await page.waitForTimeout(300);
  await page.evaluate((to) => window.__shadeway.pick(to), walk.to);
  await page.waitForSelector(".route-card__sun", { timeout: 30_000 });
  await page.locator(".departure-chip").click();
  await page.getByRole("option", { name: "15:00" }).click();
  await page.waitForTimeout(800);
  await mkdir(resolve(root, "screenshots"), { recursive: true });
  await page.screenshot({ path: resolve(root, "screenshots/compare.png") });
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForSelector(".in-route-screen");
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
