import { lstat, readFile, symlink, unlink } from "node:fs/promises";
import { buildPilot } from "./pilot.js";
import { formatBuildReport } from "./build.js";
import { formatReport, measure } from "./measure.js";
import { scoreLog } from "./score.js";

const command = process.argv[2] ?? "measure";
const root = new URL("../../../", import.meta.url);

if (command === "measure") {
  const cacheDir = new URL("data/cache/", root).pathname;
  const report = await measure(cacheDir);
  process.stdout.write(`${formatReport(report)}\n`);
} else if (command === "build:pilot") {
  const report = await buildPilot(
    new URL("data/cache/", root).pathname,
    new URL("data/build/bgc/", root).pathname,
    new URL("data/overrides/bgc.json", root).pathname,
  );
  await linkPilotDir(new URL("data/build/", root).pathname);
  process.stdout.write(`${formatBuildReport(report)}\n`);
} else if (command === "score") {
  const file = process.argv[3];
  if (file === undefined) throw new Error("score needs a walk log path");
  const text = await readFile(file, "utf8");
  process.stdout.write(`${scoreLog(JSON.parse(text) as unknown)}\n`);
} else {
  throw new Error(`unknown command: ${command}`);
}

/** The Pages script copies `data/build/pilot/`. The area directory is `bgc`. */
async function linkPilotDir(buildRoot: string): Promise<void> {
  const link = `${buildRoot}pilot`;
  try {
    const stat = await lstat(link);
    if (!stat.isSymbolicLink()) throw new Error("data/build/pilot exists and is not a symlink");
    await unlink(link);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") throw error;
  }
  await symlink("bgc", link);
}
