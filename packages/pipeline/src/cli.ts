import { formatReport, measure } from "./measure.js";

const cacheDir = new URL("../../../data/cache/", import.meta.url).pathname;
const report = await measure(cacheDir);
process.stdout.write(`${formatReport(report)}\n`);
