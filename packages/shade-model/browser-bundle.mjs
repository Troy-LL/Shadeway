import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "src");

const sourceFiles = readdirSync(srcDir).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
const forbidden = /\bfrom\s+["'](?:node:|fs|path|os|http|https|child_process|url|module)["']|\b(?:document|window|localStorage)\b/;
for (const name of sourceFiles) {
  const text = readFileSync(join(srcDir, name), "utf8");
  if (forbidden.test(text)) {
    console.error(`${name} is not browser safe`);
    process.exit(1);
  }
}

function findRolldown() {
  let dir = here;
  for (let i = 0; i < 5; i++) {
    const pnpm = join(dir, "node_modules", ".pnpm");
    if (existsSync(pnpm)) {
      const hit = readdirSync(pnpm).find((name) => name.startsWith("rolldown@"));
      if (hit) return join(pnpm, hit, "node_modules", "rolldown", "dist", "index.mjs");
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const rolldownPath = findRolldown();
if (rolldownPath === null || !existsSync(rolldownPath)) {
  console.error("rolldown is not installed");
  process.exit(1);
}

const { rolldown } = await import(pathToFileURL(rolldownPath).href);
const bundle = await rolldown({
  input: join(srcDir, "index.ts"),
  cwd: here,
  platform: "browser",
});
const generated = await bundle.generate({ format: "esm" });
const code = generated.output.map((chunk) => chunk.code ?? "").join("\n");
if (code.length < 100 || forbidden.test(code) || /\brequire\(/.test(code)) {
  console.error("browser bundle is empty or depends on Node");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "shade-model-"));
try {
  const outfile = join(dir, "shade-model.mjs");
  writeFileSync(outfile, code);
  const probe = join(dir, "probe.mjs");
  writeFileSync(
    probe,
    `import { shadeModel } from ${JSON.stringify(pathToFileURL(outfile).href)};
const passed = shadeModel.transmittance([121.05, 14.55]);
if (passed !== 1) process.exit(1);
const sun = shadeModel.sunPosition({ date: "2026-06-21", minutes: 12 * 60 }, [121.05, 14.55]);
if (!(sun.elevationDeg > 80 && sun.azimuthDeg > 350)) process.exit(1);
`,
  );
  const ran = spawnSync(process.execPath, [probe], { encoding: "utf8" });
  if (ran.status !== 0) {
    console.error(ran.stderr || ran.stdout);
    process.exit(ran.status ?? 1);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
